var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var sharedMomentsArea = document.querySelector('#shared-moments');
var form = document.querySelector('form');
var titleInput = document.querySelector('#title');
var locationInput = document.querySelector('#location');

function openCreatePostModal() {
  createPostArea.style.transform = 'translateY(0vh)';
  if (deferredPrompt) {
    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(function (choiceResult) {
      console.log(choiceResult.outcome);

      if (choiceResult.outcome === 'dismissed') {
        console.log('User cancelled installation');
      } else {
        console.log('User added to home screen');
      }
    });

    deferredPrompt = null;
  }
  // if ('serviceWorker' in navigator) {
  //   navigator.serviceWorker.getRegistrations()
  //     .then(function (registrations) {
  //       for (var i = 0; i < registrations.length; i++){
  //         registrations[i].unregister();
  //       }
  //     })
  // }
}

function closeCreatePostModal() {
  createPostArea.style.transform = 'translateY(100vh)';
}

shareImageButton.addEventListener('click', openCreatePostModal);

closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);
//user requested cache, currently not used
// function onSaveButtonClicked(event) {
//   if ('caches' in window) {
//     caches.open('user-requested')
//       .then(function (cache) { 
//         cache.add('https://httpbin.org/get');
//         cache.add('/src/images/sf-boat.jpg');
//       })
//   }
// };
function clearCards() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
  }
}

function createCard(data) {
  var cardWrapper = document.createElement('div');
  cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';
  var cardTitle = document.createElement('div');
  cardTitle.className = 'mdl-card__title';
  cardTitle.style.backgroundImage = 'url(' + data.image + ')';
  cardTitle.style.backgroundSize = 'cover';
  // cardTitle.style.backgroundPosition = 'bottom';
  cardWrapper.appendChild(cardTitle);
  var cardTitleTextElement = document.createElement('h2');
  cardTitleTextElement.style.color = 'white';
  cardTitleTextElement.className = 'mdl-card__title-text';
  cardTitleTextElement.textContent = data.title;
  cardTitle.appendChild(cardTitleTextElement);
  var cardSupportingText = document.createElement('div');
  cardSupportingText.className = 'mdl-card__supporting-text';
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = 'center';
  // var cardSaveButton = document.createElement('button');
  // cardSaveButton.textContent = 'Save!';
  // cardSaveButton.addEventListener('click', onSaveButtonClicked);
  // cardSupportingText.appendChild(cardSaveButton);
  cardWrapper.appendChild(cardSupportingText);
  componentHandler.upgradeElement(cardWrapper);
  sharedMomentsArea.appendChild(cardWrapper);
}

function updateUI(data) {
  clearCards();
  for (var i = 0; i < data.length; i++) {
    createCard(data[i]);
  }
}

var fetchUrl = 'https://pwagram-511f6.firebaseio.com/posts.json';
var networkDataReceived = false;

var header = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify({
    message: 'Some message!'
  })
}

fetch(fetchUrl)
  .then(function (response) {
    return response.json();
  })
  .then(function (data) {
    networkDataReceived = true;
    console.log('From web ', data)
    var dataArray = [];
    for (var key in data) {
      dataArray.push(data[key]);
    }
    updateUI(dataArray);
  })

if ('indexedDB' in window) {
  readAllData('posts')
    .then(function (data) {
      if (!networkDataReceived) {
        console.log('From cache ', data);
        updateUI(data);
      }
    });
}
// fetch('https://httpbin.org/get')
//   .then(function (res) {
//     return res.json();
//   })
//   .then(function (data) {
//     createCard();
//   });

form.addEventListener('submit', function (event) {
  event.preventDefault();

  var titleValue = titleInput.value.trim();
  var locationValue = locationInput.value.trim();

  if (titleValue === "" || locationValue === "") {
    alert("Please enter valid data!");
    return;
  }
  closeCreatePostModal();
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then(function (sw) {
        var post = {
          id: new Date().toISOString(),
          title: titleValue,
          location: locationValue
        };
        writeData('sync-posts', post)
          .then(function () {
            sw.sync.register('sync-new-posts');
          })
          .then(function () {
            var snackBarContainer = document.querySelector('#confirmation-toast');
            var data = { message: "Your post was saved for sync!" };
            snackBarContainer.MaterialSnackbar.showSnackbar(data);
          })
          .catch(function (error) {
            console.log(error);
          });
      });
  } else {
    sendData();
  }

});

function sendData() {
  var headers = {
    method: 'POST',
    headers: {
      'Content-type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      id: new Date().toISOString(),
      title: titleValue,
      location: locationValue,
      image: 'http://supercinemaup.com/wp-content/uploads/2017/11/super-mario-bros-super-cinema-up-1-1024x640.jpg'
    })
  }
  fetch('https://us-central1-pwagram-511f6.cloudfunctions.net/storePostData', headers)
    .then(function (res) {
      console.log('Sent Data', res);
      updateUI();
    });
}