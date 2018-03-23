importScripts('/src/js/idb.js');
importScripts('/src/js/utils.js');

var CACHE_STATIC_VERSION = 'static-v20';
var CACHE_DYNAMIC_VERSION = 'dynamic-v4';
var STATIC_FILES = ['/',
  '/index.html',
  '/offline.html',
  '/src/js/app.js',
  '/src/js/feed.js',
  '/src/js/idb.js',
  '/src/js/utils.js',
  '/src/js/promise.js',
  '/src/js/fetch.js',
  '/src/js/material.min.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  '/src/images/main-image.jpg',
  'https://fonts.googleapis.com/css?family=Roboto:400,700',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
];


//Function to limit the maximum items on cache
// function trimCache(cacheName, maxItems) {
//   caches.open(cacheName)
//     .then(function (cache) {
//       return cache.keys()
//         .then(function (keys) {
//           if (keys.length > maxItems) {
//             //remove the oldest cache
//             cache.delete(keys[0])
//               .then(trimCache(cacheName, maxItems));
//           }
//         })
//     })
// }

self.addEventListener('install', function (event) {
  console.log('[Service Worker] Installing Service Worker ...', event);
  //Use the version to force a change in the service worker, this forces the SW to update the sub-cache.
  event.waitUntil(caches.open(CACHE_STATIC_VERSION)
    .then(function (cache) {
      console.log('[Service Worker] PreCaching App Shell.');
      cache.addAll(STATIC_FILES);
      /** Request the file, download, and store it. I can use single caching with add() method
       * or make an array to store them all with the addAll() method.
       */
    })
  )
});

self.addEventListener('activate', function (event) {
  console.log('[Service Worker] Activating Service Worker ....', event);
  //Clean up the older versions of the cache, doing here 'cos it triggers only when the user close all the tabs and reopen.
  event.waitUntil(
    caches.keys()
      .then(function (keyList) {
        return Promise.all(keyList.map(function (key) {
          if (key !== CACHE_STATIC_VERSION && key !== CACHE_DYNAMIC_VERSION) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        }));
      })
  )
  return self.clients.claim();
});

//CACHE THEN NETWORK STRATEGY
/**Cache, then Network Strategy
1 - The page reaches out directly the cache, and get the value back, if the network is fast it uses the network response
2 - Also reaches the Service Worker simultaneously to the access of the cache, the SW try to fetch with network,
if it gets an response, the SW store the new data in the cache
3 - return the fetch to the page
THE BEST STRATEGY
Implementation: starts in the JS file, for example the feed.js
*/
self.addEventListener('fetch', function (event) {
  var url = 'https://pwagram-511f6.firebaseio.com/posts.json';

  if (event.request.url.indexOf(url) > -1) {
    event.respondWith(fetch(event.request)
      .then(function (resp) {
        var clonedResp = resp.clone();
        clearAllData('posts')
          .then(function () {
            return clonedResp.json()
          })
          .then(function (data) {
            for (var key in data) {
              writeData('posts', data[key])
                .then(function () {
                  // deleteItemFromData('posts', key);
                });
            }
          });
        return resp;
      })
    );
  } else if (isInArray(event.request.url, STATIC_FILES)) {
    event.respondWith(
      caches.match(event.request)
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(function (response) {
          if (response) {
            return response;
          } else {
            return fetch(event.request)//Dynamic cache
              .then(function (resp) {
                return caches.open(CACHE_DYNAMIC_VERSION)
                  .then(function (cache) {
                    // trimCache(CACHE_DYNAMIC_VERSION, 10);
                    cache.put(event.request.url, resp.clone());
                    return resp;
                  })
              }).catch(function (err) {
                return caches.open(CACHE_STATIC_VERSION)
                  .then(function (cache) {
                    if (event.request.headers.get('accept').includes('text/html')) {
                      return cache.match('/offline.html')
                    }
                  });
              });
          }
        })
    )
  }
});

function isInArray(string, array) {
  var cachePath;
  if (string.indexOf(self.origin) === 0) {
    console.log('matched ', string);
    cachePath = string.substring(self.origin.length);
  } else {
    cachePath = string;
  }
  return array.indexOf(cachePath) > -1;
}

// self.addEventListener('fetch', function (event) {
//   event.respondWith(
//     caches.match(event.request)
//       .then(function (response) {
//         if (response) {
//           return response;
//         } else {
//           return fetch(event.request)//Dynamic cache
//             .then(function (resp) {
//               return caches.open(CACHE_DYNAMIC_VERSION)
//                 .then(function (cache) {
//                   cache.put(event.request.url, resp.clone());
//                   return resp;
//                 })
//             }).catch(function (err) {
//               return caches.open(CACHE_STATIC_VERSION)
//                 .then(function (cache) {
//                   return cache.match('/offline.html')
//                 });
//             });             
//         }
//       })
//   );
// });

//Cache ONLY Strategy - don't work properly cos' it's not dynamic
// self.addEventListener('fetch', function (event) {
//   event.respondWith(
//     caches.match(event.request)
//   );
// });

//Network ONLY Strategy - don't work properly cos' don't cache anything
// self.addEventListener('fetch', function (event) {
//   event.respondWith(
//     fetch(event.request)
//   );
// });

//Network with CACHE fallback, only search in the cache when can't reach the web
//Not the best option because of the timeout problem
// self.addEventListener('fetch', function (event) {
//   event.respondWith(
//     fetch(event.request)
//       .then(function (res) {
//         return caches.open(CACHE_DYNAMIC_VERSION)
//           .then(function (cache) {
//             cache.put(event.request.url, res.clone());
//             return res;
//           })
//       })
//       .catch(function (err) {
//         return caches.match(event.request)
//       })
//   );
// });

self.addEventListener('sync', function (event) {
  console.log('[Service Worker] Syncing', event);
  if (event.tag === 'sync-new-posts') {
    console.log('[Service Worker] Syncing new posts');
    event.waitUntil(
      readAllData('sync-posts')
        .then(function (data) {
          for (var dt of data) {
            var headers = {
              method: 'POST',
              headers: {
                'Content-type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                id: dt.id,
                title: dt.title,
                location: dt.location,
                image: 'http://supercinemaup.com/wp-content/uploads/2017/11/super-mario-bros-super-cinema-up-1-1024x640.jpg'
              })
            }
            fetch('https://us-central1-pwagram-511f6.cloudfunctions.net/storePostData', headers)
              .then(function (res) {
                console.log('Sent Data ', res);
                if (res.ok) {
                  res.json()
                    .then(function (resData) {
                      deleteItemFromData('sync-posts', resData.id);
                    });
                }
              })
              .catch(function (err) {
                console.log('Error on sync: ', err)
              })
          }
        })
    );
  }
});
