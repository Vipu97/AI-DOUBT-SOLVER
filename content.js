let overlayVisiblity = false, overlayElement, currentRequestController = null,folowUp = false,feedbackDivUp = null,
feedbackDivDown = null, loaderMessage = null, threadId = null, runId = null, followUpContainer = null;
const prompt = "Answer the question from the image in the form of HTML tags only for the whole response and dont't write response in the form of any program for the question.Use h7 for headings and p tag for content and just send the markup which is present inside the body tag, also highlight some mathematical calculation and important point in response by orange or golden color.Also, give font weight bold to final answer and headings in the response, keep the p tag markup font weight value to 200,margin bottom to 3px and font size to 12px and give some margin top of around 4px to heading and answer and use sup tag to display powers and all mathematical equations and text-align all the content to the left. Generate the response within 100 words.Try to answer from the option if available";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ShowOverlay' && !overlayVisiblity) {
    hideResponseContainer();
    showOverlay();
    overlayVisiblity = true;
  } else if (message.action === 'HideOverlay' && overlayVisiblity) {
    hideOverlay();
    overlayVisiblity = false;
  } else if (message.action === 'ExecuteScript') {
    const { dataUrl, x, y, width, height } = message;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const image = new Image();
    image.onload = () => {
      context.drawImage(image, x, y, width, height, 0, 0, width, height);
      canvas.toBlob(blob => {
        submitQuestion(blob)
      }, 'image/png')
    };
    image.src = dataUrl;
  }
});

function extractTextFromImage(blob) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(blob);
    Tesseract.recognize(
      imageUrl, // The image URL or base64 data URL
      'eng',    // Language code
    ).then(({ data: { text } }) => {
      console.log('Extracted text:', text);
      resolve(text); // Resolve the extracted text
    }).catch(error => {
      console.error('Error extracting text:', error);
      reject(error); // Reject in case of error
    });
  });
}

async function submitQuestion(blob) {
  try {
    if (currentRequestController) {
      currentRequestController.abort();
    }
    currentRequestController = new AbortController();
    const { signal } = currentRequestController;
    showResponseContainerWithLoader();
    const question = await extractTextFromImage(blob);
    const formData = new FormData();
    formData.append('image', blob, 'captured-image.png');
    formData.append('question', prompt);
    folowUp = false;

    const response = await fetch('https://aiktech.in/api/account/profile/generate_reasoning/', {
      method: 'POST',
      body: formData,
      signal: signal
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder(); // Convert bytes to string
    let result = '';

    // Function to process each chunk
    const processChunk = async ({ done, value }) => {
      if (done) {
        // End of the stream
        result = extractThreadAndRunId(result);
        updateResponseContainer(result);
        return;
      }

      // Decode and append chunk to result
      result += decoder.decode(value, { stream: true });
      console.log(result);

      // Update the response container with the current result
      // updateResponseContainer(result);
      // Continue reading the next chunk
      reader.read().then(processChunk);
    };

    // Start reading the first chunk
    reader.read().then(processChunk);

  } catch (err) {
    console.log(err.message);
    updateResponseContainer("Unable to get response. Try Again!");
  }
}

function extractThreadAndRunId(str) {
  const jsonRegex = /{"internal_values":\s?{.*?}}/;
  const jsonMatch = str.match(jsonRegex);

  if (jsonMatch) {
    const jsonString = jsonMatch[0];
    try {
      const parsedJson = JSON.parse(jsonString);
      threadId = parsedJson.internal_values.thread_id;
      runId = parsedJson.internal_values.run_id;
      console.log(`Thread ID: ${threadId}, Run ID: ${runId}`);
    } catch (error) {
      console.error("Error parsing JSON:", error);
    }
  }

  // Step 2: Extract the first line after the JSON part
  return str.replace(jsonRegex, '').trim();
}
function showOverlay() {
  overlayElement = document.createElement('div');
  overlayElement.style.position = 'fixed';
  overlayElement.style.top = '0';
  overlayElement.style.left = '0';
  overlayElement.style.width = '100%';
  overlayElement.style.height = '100%';
  overlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
  overlayElement.style.zIndex = '9999';
  overlayElement.style.cursor = `url(${chrome.runtime.getURL('crosshair-icon.png')}), auto`;
  let startX, startY;
  let rect;

  const onMouseDown = (event) => {
    if (rect && overlayElement.hasChildNodes(rect)) {
      overlayElement.removeChild(rect)
    }

    startX = event.clientX
    startY = event.clientY

    rect = document.createElement('div')
    rect.style.position = "fixed";
    rect.style.left = `${startX}px`;
    rect.style.top = `${startY}px`;
    rect.style.width = "0";
    rect.style.height = "0";
    rect.style.outline = "2px dashed #fff";
    rect.style.boxSizing = "border-box";
    rect.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
    rect.style.pointerEvents = "none";
    rect.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.7)';
    overlayElement.appendChild(rect)

    const onMouseMove = (event) => {

      const currentX = event.clientX;
      const currentY = event.clientY;

      const width = currentX - startX;
      const height = currentY - startY;

      rect.style.width = `${Math.abs(width)}px`
      rect.style.height = `${Math.abs(height)}px`

      if (width < 0) {
        rect.style.left = `${currentX}px`
      }

      if (height < 0) {
        rect.style.top = `${currentY}px`
      }
    }

    const onMouseUp = () => {
      overlayElement.removeEventListener('mousemove', onMouseMove)
      overlayElement.removeEventListener('mouseup', onMouseUp)
      setTimeout(() => {
        const rectBounds = rect.getBoundingClientRect();
        let x = rectBounds.left;
        let y = rectBounds.top + 40;
        let width = rectBounds.width * 1.35;
        let height = rectBounds.height * 1.25;
        if (height < 100) {
          height *= 1.2;
        }
        hideOverlay();
        chrome.runtime.sendMessage({ action: 'HideOverlay' })
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'CaptureContent', x, y, width, height });
        }, 200);
      }, 200)
    }

    overlayElement.addEventListener('mousemove', onMouseMove)
    overlayElement.addEventListener('mouseup', onMouseUp)
  }

  overlayElement.addEventListener('mousedown', onMouseDown)

  document.body.appendChild(overlayElement);

}

function hideOverlay() {
  if (overlayElement && overlayElement.parentNode) {
    overlayElement.parentNode.removeChild(overlayElement);
  }
}
function displayCapturedImage(blob) {
  const imageUrl = URL.createObjectURL(blob);
  const imgElement = document.createElement('img'); // Create an img element
  imgElement.src = imageUrl;
  imgElement.alt = 'Captured Image';
  imgElement.style.maxWidth = '100%'; // Optional: Set maximum width for responsiveness
  imgElement.style.height = 'auto';   // Optional: Set height to auto

  // Append the img element to the DOM
  const displayArea = document.getElementById('image-display-area'); // Assuming an element with this id exists in your HTML
  displayArea.innerHTML = ''; // Clear any previous images
  displayArea.appendChild(imgElement);
}

function hideResponseContainer() {
  const container = document.getElementById('api-response-container');
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

function showResponseContainerWithLoader() {
  let container = document.getElementById('api-response-container');
  if (!container) {
    parentContainer = document.createElement('div');
    parentContainer.style.padding = "4px";
    parentContainer.style.position = 'relative';
    container = document.createElement('div');
    container.id = 'api-response-container';
    container.style.position = 'fixed';
    container.style.top = '50px';
    container.style.right = '20px';
    container.style.padding = '15px 10px';
    container.style.paddingBottom = '8px';
    container.style.minWidth = "320px";
    container.style.maxWidth = '440px';
    container.style.backgroundColor = '#f9f9f9';
    container.style.borderRadius = '12px';
    container.style.boxShadow = 'rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset, rgba(0, 0, 0, 0.3) 0px 18px 36px -18px inset';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#333';
    container.style.lineHeight = '1.5';
    container.style.fontSize = '13px';
    container.style.overflow = 'auto';
    container.style.maxHeight = '500px';
    container.style.minHeight = "350px";
    container.style.zIndex = '10000';

    // Add border animation
    container.style.border = '4px solid transparent';
    container.style.backgroundClip = 'padding-box';
    container.style.animation = 'borderAnimation 3s infinite';

    // Create and style the close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.border = '2px solid rgb(194 193 190)';
    closeButton.style.background = 'none';
    closeButton.style.fontSize = '16px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = 'black';
    closeButton.style.padding = '0';
    closeButton.style.margin = '0';
    closeButton.style.borderRadius = '50%';
    closeButton.style.width = '24px';
    closeButton.style.height = '24px';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

    closeButton.addEventListener('click', () => {
      hideResponseContainer();
    });

    // Append the close button to the container
    container.appendChild(closeButton);

    // Append the container to the body
    document.body.appendChild(container);
  }

  const headingDiv = document.createElement('div');
  headingDiv.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 20px; justify-content:center; gap:8px">
      <img src="${chrome.runtime.getURL('icon.png')}" alt="logo" style="width: 20px; height: 20px;" />
      <span style="font-size: 15px; font-weight: bold; color: #84b7f4; margin-right: 10px;">AI DOUBT SOLVER</span>
    </div>
  `;

  const existingHeading = container.querySelector('div > div');
  if (existingHeading) {
    existingHeading.remove();
  }

  container.insertBefore(headingDiv, container.firstChild);


  // Display the loader
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.style.border = '5px solid #f3f3f3'; /* Light grey */
  loader.style.borderTop = '5px solid #3498db'; /* Blue */
  loader.style.borderRadius = '50%';
  loader.style.width = '40px';
  loader.style.height = '40px';
  loader.style.animation = 'spin 2s linear infinite';
  loader.style.margin = 'auto';
  loader.style.marginTop = "5rem";
  loader.style.position = 'relative';
  loader.style.top = '50%';
  loader.style.transform = 'translateY(-50%)';

  loaderMessage = document.createElement('p');
  loaderMessage.style.color = '#84b7f4';  // Set text color to blue
  loaderMessage.style.fontSize = '14px';  // Set font size
  loaderMessage.style.fontWeight = 'bold';  // Make text bold
  loaderMessage.style.marginTop = '10px';  // Add some spacing
  loaderMessage.style.textAlign = 'center';  // Center-align the text
  loaderMessage.style.paddingLeft = '10px';
  container.appendChild(loader);
  setTimeout(() => {
    if (folowUp) {
      // If folowUp is true, directly show "Analysing Question..."
      loaderMessage.textContent = "Analysing Question...";
      container.insertBefore(loaderMessage, container.lastChild);
    } else {
      // If folowUp is false, go through the normal flow
      loaderMessage.textContent = "Processing Image...";
      container.insertBefore(loaderMessage, container.lastChild);

      setTimeout(() => {
        loaderMessage.textContent = "Parsing Text From Image...";
        
        setTimeout(() => {
          loaderMessage.textContent = "Analysing Question...";
        }, 4000); // Wait 4 seconds before showing "Analysing Question..."
        
      }, 4000); // Wait 4 seconds before showing "Parsing Text From Image..."
    }
}, 0);

  // Add keyframe animation for the border
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes borderAnimation {
      0% {
        border-color: #ff6347;
      }
      25% {
        border-color: #32cd32;
      }
      50% {
        border-color: #1e90ff;
      }
      75% {
        border-color: #ffeb3b;
      }
      100% {
        border-color: #ff6347;
      }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Create the follow-up question input and submit button
  if (followUpContainer) {
    followUpContainer.remove();
  }
  followUpContainer = document.createElement('div');
  followUpContainer.style.marginTop = '110px'; // Add spacing from the content
  followUpContainer.style.textAlign = 'center'; // Center-align the elements
  followUpContainer.style.display = 'flex';
  followUpContainer.style.alignItems = 'center';
  followUpContainer.style.position = "sticky";
  followUpContainer.style.bottom = '0px';
  followUpContainer.style.gap = '8px';

  const followUpInput = document.createElement('input');
  followUpInput.type = 'text';
  followUpInput.placeholder = 'Ask a follow-up question...';
  followUpInput.style.width = '100%';
  followUpInput.style.padding = '6px';
  followUpInput.style.border = '1px solid #ddd';
  followUpInput.style.borderRadius = '4px';
  followUpInput.style.fontSize = '13px';
  followUpInput.style.boxShadow = '0 4px 8px 0 rgba(0,0,0,0.2)';
  followUpInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      handleFollowUpQuestion(followUpInput.value);
      followUpInput.value = "";
    }
  });
  const submitButton = document.createElement('img');
  submitButton.src = `${chrome.runtime.getURL('submit.png')}`;
  submitButton.style.border = 'none';
  submitButton.style.borderRadius = '4px';
  submitButton.style.cursor = 'pointer';
  submitButton.style.fontSize = '14px';
  submitButton.style.width = "30px";
  submitButton.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
  submitButton.addEventListener('click', () => {
    handleFollowUpQuestion(followUpInput.value);
    followUpInput.value = "";
  });
  // Add hover effect
  submitButton.addEventListener('mouseover', () => {
    submitButton.style.opacity = '0.8'; // Change opacity or any other effect
    submitButton.style.transform = 'scale(1.2)'; // Slight zoom-in effect
  });

  submitButton.addEventListener('mouseout', () => {
    submitButton.style.opacity = '1';
    submitButton.style.transform = 'scale(1)'; // Reset zoom
  });
  followUpContainer.appendChild(followUpInput);
  followUpContainer.appendChild(submitButton);
  container.appendChild(followUpContainer);
}

function updateResponseContainer(content) {
  const container = document.getElementById('api-response-container');
  if (container) {
    // Remove the loader
    const loader = container.querySelector('.loader');
    const loaderMessage = container.querySelector('p');
    if (loader) loader.remove();
    if (loaderMessage) loaderMessage.remove();

    // Update the container's content
    const responseContent = document.createElement('div');
    const responseContainer = document.createElement('div');
    const feedBackContainer = document.createElement('div');
    responseContainer.innerHTML = content || 'Sorry, we were unable to get a response. Please try again.';
    responseContainer.style.width = "90%";
    responseContainer.style.marginRight = 'auto';
    responseContainer.style.minHeight = '50px';
    responseContainer.style.padding = '8px';
    responseContainer.style.backgroundColor = '#fff';
    responseContainer.style.borderRadius = '10px';
    responseContainer.style.boxShadow = '0 4px 8px 0 rgba(0,0,0,0.2)';
    responseContainer.style.display = 'flex';
    responseContainer.style.flexDirection = 'column';
    responseContainer.style.marginTop = '15px';
    responseContainer.style.position = 'relative';
    responseContent.appendChild(responseContainer);
    feedBackContainer.style.display = "flex";
    feedBackContainer.style.gap = '8px';
    feedBackContainer.style.position = 'absolute';
    feedBackContainer.style.right = '10%';
    feedBackContainer.style.cursor = "pointer";
    feedBackContainer.style.translate = '-10px -10px';
    feedBackContainer.style.fontSize = '20px';
    feedbackDivUp = document.createElement('div');
    feedbackDivDown = document.createElement('div');
    feedbackDivUp.style.backgroundColor = '#d9e6f6';
    feedbackDivDown.style.backgroundColor = '#d9e6f6';
    feedbackDivUp.style.padding = '2px';
    feedbackDivDown.style.padding = '2px';
    feedbackDivDown.style.borderRadius = '5px';
    feedbackDivUp.style.borderRadius = '5px';
    feedbackDivUp.innerHTML = '👍';
    feedbackDivDown.innerHTML = '👎';
    feedbackDivDown.addEventListener('click', () => sendFeedBack('NEGATIVE'));
    feedbackDivUp.addEventListener('click', () => sendFeedBack('POSITIVE'));
    feedBackContainer.appendChild(feedbackDivUp);
    feedBackContainer.appendChild(feedbackDivDown);
    responseContent.appendChild(feedBackContainer);
    container.insertBefore(responseContent, container.lastChild);
  }
}

async function handleFollowUpQuestion(question) {
  if (question.trim() === '') {
    return; // Exit early if the question is empty
  }

  // Display the follow-up question in the UI
  const container = document.getElementById('api-response-container');
  const followUpQuestion = document.createElement('div');
  followUpQuestion.textContent = question;
  followUpQuestion.style.marginLeft = 'auto';
  followUpQuestion.style.width = 'max-content';
  followUpQuestion.style.maxWidth = '85%';
  followUpQuestion.style.textAlign = 'end';
  followUpQuestion.style.fontWeight = '600';
  followUpQuestion.style.padding = '7px 10px';
  followUpQuestion.style.backgroundColor = '#d9e6f6';
  followUpQuestion.style.boxShadow = '0 4px 8px 0 rgba(0,0,0,0.2)';
  followUpQuestion.style.cursor = 'pointer';
  followUpQuestion.style.marginTop = '35px';
  followUpQuestion.style.borderRadius = '10px';
  container.insertBefore(followUpQuestion, container.lastChild);

  try {
    // Prepare the payload and send it to the server
    if (currentRequestController) {
      currentRequestController.abort();
    }
    currentRequestController = new AbortController();
    const { signal } = currentRequestController;
    showResponseContainerWithLoader();
    const formData = new FormData();
    formData.append('question', question + ". " + prompt);
    formData.append('thread_id', threadId);
    folowUp = true;

    const response = await fetch('https://aiktech.in/api/account/profile/follow_up/', {
      method: 'POST',
      body: formData,
      signal: signal
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    // Read and process the response stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder(); // Convert bytes to string
    let result = '';

    // Function to process each chunk
    const processChunk = async ({ done, value }) => {
      if (done) {
        // End of the stream
        result = extractThreadAndRunId(result); // Ensure this function is defined
        updateResponseContainer(result); // Ensure this function is defined
        loaderMessage.remove();
        return;
      }

      // Decode and append chunk to result
      result += decoder.decode(value, { stream: true });
      console.log(result);

      // Continue reading the next chunk
      reader.read().then(processChunk);
    };

    // Start reading the first chunk
    reader.read().then(processChunk);

  } catch (err) {
    console.error(err.message);
    updateResponseContainer("Unable to get response. Try Again!"); // Ensure this function is defined
  }
}

function hideResponseContainer() {
  const container = document.getElementById('api-response-container');
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

async function sendFeedBack(feedback) {
  try {
    const formData = new FormData();
    formData.append('run_id', runId);
    formData.append('feedback', feedback);

    const response = await fetch('https://aiktech.in/api/account/profile/feedback/', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    if(feedback == "POSITIVE"){
      feedbackDivUp.style.scale = '110%';
      feedbackDivDown.style.scale = '85%';
    }else{
      feedbackDivUp.style.scale = '85%';
      feedbackDivDown.style.scale = '110%';
    }
  } catch (err) {
    console.error("Errorn Sending Feedback" + err.message);
  }
}