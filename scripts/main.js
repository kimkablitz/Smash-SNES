// /Copyright 2018 KKL Group.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


// ===========================================================================================================
// ===========================================================================================================
//     INITIALIZE GOOGLE SIGN-IN WITH REFERCENCES FROM GOOGLE CODELAB 254-261 ARE DELETABLE WHEN TOAST IS NOT IN USE
// ===========================================================================================================
// ===========================================================================================================


"use strict";

// Signs-in 
function signIn() {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
}

// Signs-out 
function signOut() {
  // Sign out of Firebase.
  firebase.auth().signOut();
}

// Initiate firebase auth.
function initFirebaseAuth() {
  // Listen to auth state changes.
  firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
  return firebase.auth().currentUser.photoURL;
}

// Returns the signed-in user's display name.
function getUserName() {
  return firebase.auth().currentUser.displayName;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
  return !!firebase.auth().currentUser;
}

// Loads chat messages history and listens for upcoming ones.
function loadMessages() {
  // Loads the last 12 messages and listen for new ones.
  var callback = function(snap) {
    var data = snap.val();
    displayMessage(
      snap.key,
      data.name,
      data.text,
      data.profilePicUrl,
      data.imageUrl
    );
  };

  database
    .ref("/messages/")
    .limitToLast(12)
    .on("child_added", callback);
  database
    .ref("/messages/")
    .limitToLast(12)
    .on("child_changed", callback);
}

// Saves a new message on the Firebase DB.
function saveMessage(messageText) {
  // Add a new message entry to the Firebase database.
  return database
    .ref("/messages/")
    .push({
      name: getUserName(),
      text: messageText,
      profilePicUrl: getProfilePicUrl()
    })
    .catch(function(error) {
      console.error("Error writing new message to Firebase Database", error);
    });
}

// Saves a new message containing an image in Firebase.
// This first saves the image in Firebase storage.
function saveImageMessage(file) {
  // 1 - We add a message with a loading icon that will get updated with the shared image.
  database
    .ref("/messages/")
    .push({
      name: getUserName(),
      imageUrl: LOADING_IMAGE_URL,
      profilePicUrl: getProfilePicUrl()
    })
    .then(function(messageRef) {
      // 2 - Upload the image to Cloud Storage.
      var filePath =
        firebase.auth().currentUser.uid +
        "/" +
        messageRef.key +
        "/" +
        file.name;
      return firebase
        .storage()
        .ref(filePath)
        .put(file)
        .then(function(fileSnapshot) {
          // 3 - Generate a public URL for the file.
          return fileSnapshot.ref.getDownloadURL().then(url => {
            // 4 - Update the chat message placeholder with the image’s URL.
            return messageRef.update({
              imageUrl: url,
              storageUri: fileSnapshot.metadata.fullPath
            });
          });
        });
    })
    .catch(function(error) {
      console.error(
        "There was an error uploading a file to Cloud Storage:",
        error
      );
    });
}

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
  firebase
    .messaging()
    .getToken()
    .then(function(currentToken) {
      if (currentToken) {
        console.log("Got FCM device token:", currentToken);
        // Saving the Device Token to the datastore.
        database
          .ref("/fcmTokens")
          .child(currentToken)
          .set(firebase.auth().currentUser.uid);
      } else {
        // Need to request permissions to show notifications.
        requestNotificationsPermissions();
      }
    })
    .catch(function(error) {
      console.error("Unable to get messaging token.", error);
    });
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
  console.log("Requesting notifications permission...");
  firebase
    .messaging()
    .requestPermission()
    .then(function() {
      // Notification permission granted.
      saveMessagingDeviceToken();
    })
    .catch(function(error) {
      console.error("Unable to get permission to notify.", error);
    });
}

// Triggered when a file is selected via the media picker.
function onMediaFileSelected(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  imageFormElement.reset();

  // Check if the file is an image.
  if (!file.type.match("image.*")) {
    var data = {
      message: "You can only share images",
      timeout: 2000
    };
    signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (checkSignedInWithMessage()) {
    saveImageMessage(file);
  }
}

// Triggered when the send new message form is submitted.
function onMessageFormSubmit(e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.
  if (messageInputElement.value && checkSignedInWithMessage()) {
    saveMessage(messageInputElement.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      resetMaterialTextfield(messageInputElement);
      toggleButton();
    });
  }
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user) {
    // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    let userName = getUserName();

    //handles
    characterHandlers();

    // Set the user's profile pic and name.
    userPicElement.style.backgroundImage = "url(" + profilePicUrl + ")";
    userNameElement.textContent = userName;

    // Show user's profile and sign-out button.
    userNameElement.removeAttribute("hidden");
    userPicElement.removeAttribute("hidden");
    signOutButtonElement.removeAttribute("hidden");

    // Hide sign-in button.
    signInButtonElement.setAttribute("hidden", "true");

    // We save the Firebase Messaging Device token and enable notifications.
    saveMessagingDeviceToken();
  } else {
    // User is signed out!
    // Hide user's profile and sign-out button.
    userNameElement.setAttribute("hidden", "true");
    userPicElement.setAttribute("hidden", "true");
    signOutButtonElement.setAttribute("hidden", "true");

    // Show sign-in button.
    signInButtonElement.removeAttribute("hidden");
  }
}

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
  // Return true if the user is signed in Firebase
  if (isUserSignedIn()) {
    return true;
  }

  //Display a message to the user using a Toast.
  var data = {
    message: "You must sign-in first",
    timeout: 2000
  };
  signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
  return false;
}

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
  element.value = "";
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Template for messages.
var MESSAGE_TEMPLATE =
  '<div class="message-container">' +
  '<div class="spacing"><div class="pic"></div></div>' +
  '<div class="message"></div>' +
  '<div class="name"></div>' +
  "</div>";

// A loading image URL.
var LOADING_IMAGE_URL = "https://www.google.com/images/spin-32.gif?a";

// Displays a Message in the UI.
function displayMessage(key, name, text, picUrl, imageUrl) {
  var div = document.getElementById(key);
  // If an element for that message does not exists yet we create it.
  if (!div) {
    var container = document.createElement("div");
    container.innerHTML = MESSAGE_TEMPLATE;
    div = container.firstChild;
    div.setAttribute("id", key);
    messageListElement.appendChild(div);
  }
  if (picUrl) {
    div.querySelector(".pic").style.backgroundImage = "url(" + picUrl + ")";
  }
  div.querySelector(".name").textContent = name;
  var messageElement = div.querySelector(".message");
  if (text) {
    // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, "<br>");
  } else if (imageUrl) {
    // If the message is an image.
    var image = document.createElement("img");
    image.addEventListener("load", function() {
      messageListElement.scrollTop = messageListElement.scrollHeight;
    });
    image.src = imageUrl + "&" + new Date().getTime();
    messageElement.innerHTML = "";
    messageElement.appendChild(image);
  }
  // Show the card fading-in and scroll to view the new message.
  setTimeout(function() {
    div.classList.add("visible");
  }, 1);
  messageListElement.scrollTop = messageListElement.scrollHeight;
  messageInputElement.focus();
}

// Enables or disables the submit button depending on the values of the input
// fields.
function toggleButton() {
  if (messageInputElement.value) {
    submitButtonElement.removeAttribute("disabled");
  } else {
    submitButtonElement.setAttribute("disabled", "true");
  }
}
// Initialize Firebase
var config = {
  apiKey: "AIzaSyB3XsVc-KBQ-2qELEg82RmcIShbGCFHhZE",
  authDomain: "sprite-chat-cf53a.firebaseapp.com",
  databaseURL: "https://sprite-chat-cf53a.firebaseio.com",
  projectId: "sprite-chat-cf53a",
  storageBucket: "sprite-chat-cf53a.appspot.com",
  messagingSenderId: "465590087132"
};
firebase.initializeApp(config);

//create a variable to reference the database
var database = firebase.database();

// Shortcuts to DOM Elements.
var messageListElement = document.getElementById("messages");
var messageFormElement = document.getElementById("message-form");
var messageInputElement = document.getElementById("message");
var submitButtonElement = document.getElementById("submit");
var imageButtonElement = document.getElementById("submitImage");
var imageFormElement = document.getElementById("image-form");
var mediaCaptureElement = document.getElementById("mediaCapture");
var userPicElement = document.getElementById("user-pic");
var userNameElement = document.getElementById("user-name");
var signInButtonElement = document.getElementById("sign-in");
var signOutButtonElement = document.getElementById("sign-out");
var signInSnackbarElement = document.getElementById("must-signin-snackbar");

// Saves message on form submit.
messageFormElement.addEventListener("submit", onMessageFormSubmit);
signOutButtonElement.addEventListener("click", signOut);
signInButtonElement.addEventListener("click", signIn);

// Toggle for the button.
messageInputElement.addEventListener("keyup", toggleButton);
messageInputElement.addEventListener("change", toggleButton);

// Events for image upload.
imageButtonElement.addEventListener("click", function(e) {
  e.preventDefault();
  mediaCaptureElement.click();
});
mediaCaptureElement.addEventListener("change", onMediaFileSelected);

// initialize Firebase
initFirebaseAuth();

// We load currently existing chat messages and listen to new ones.
loadMessages();


// ===========================================================================================================
// ===========================================================================================================
//     SOUNDS 
// ===========================================================================================================
// ===========================================================================================================


// THEME SONG
var audioElement = document.createElement("audio");
audioElement.setAttribute("src", "sounds/SNES.mp3");

// Theme Button
$(".sound-on").on("click", function() {
  audioElement.play();
});
$(".sound-off").on("click", function() {
  audioElement.pause();
});

// ACTION SOUNDS
//sound effect from sound.js library
var hadouken = "hadouken";
var punch = "punch";
var cut = "cut";
var jab = "jab";
var cross = "cross";
var kick = "kick";
var jump = "jump";
function loadSound() {
  createjs.Sound.registerSound("sounds/hadouken.mp3", hadouken);
  createjs.Sound.registerSound("sounds/cross.mp3", cross);
  createjs.Sound.registerSound("sounds/punch.mp3", punch);
  createjs.Sound.registerSound("sounds/cut.mp3", cut);
  createjs.Sound.registerSound("sounds/jab.mp3", jab);
  createjs.Sound.registerSound("sounds/kick.mp3", kick);
  createjs.Sound.registerSound("sounds/jump.mp3", jump);
}
loadSound();
function playHadouken() {
  createjs.Sound.play(hadouken);
}
function playCross() {
  createjs.Sound.play(cross);
}
function playPunch() {
  createjs.Sound.play(punch);
}
function playCut() {
  createjs.Sound.play(cut);
}
function playJab() {
  createjs.Sound.play(jab);
}
function playKick() {
  createjs.Sound.play(kick);
}
function playJump() {
  createjs.Sound.play(jump);
}
// ===========================================================================================================
// ===========================================================================================================
// 
//     GAME FUNCTIONALITY 
// ===========================================================================================================
// ===========================================================================================================


//initialize player 1
var goku = null;

//initialize player 2
var ryu = null;

//tracks current fighter
var myFighter = null;

//  Variable that will hold the setInterval that runs the countdown
var intervalId;

// prevents the clock from being sped up unnecessarily
var clockRunning = false;

//make handlers for click handlers for goku and ryu
function characterHandlers() {
    //add hover to goku
    $("#gokuImg").addClass("should-hover");

    //add hover to ryu
    $("#ryuImg").addClass("should-hover");

    //handles data deletion of player wins when player leaves
    database.ref("/wins/").onDisconnect().remove();

    //showcase goku info when the user clicks the character
    $("#gokuChar").on("click", function (event) {
        // Prevent the page from refreshing
        event.preventDefault();

        //check there is not already a player online
        database.ref("/players/goku").once("value").then(
            function (snapshot) {
                //check that no other player has chosen goku
                if (snapshot.val() !== null) {
                    return;
                }
                //handles player1 name selection
                goku = userNameElement.textContent;

                //update html
                $("#player1").text(goku);

                //hide instructions
                revealFigthingArena();

                //handles data deletion of player name when player leaves
                database.ref("/players/goku").onDisconnect().remove();

                //handles data deletion of keypad when player leaves
                database.ref("/keypad").onDisconnect().remove();

                //change what is saved in firebase
                database.ref("/players").update({
                    goku: goku
                });

                // Firebase is always watching for changes to the data on the character goku keypad.
                // When changes occurs it will print them to console and html
                database.ref("/keypad/ryu/").on("child_added", keyPadInputs, function (errorObject) {
                    console.log("The read failed: " + errorObject.code);
                });

                //make the fake function call the real function
                recordGokusKeyPad = recordGokusKeyPadReal;

                //current fighter
                myFighter = "goku";
            }
        );
    });

    //showcase ryu info when the user clicks the character
    $("#ryuChar").on("click", function (event) {
        // Prevent the page from refreshing
        event.preventDefault();
        //check there is not already a player online
        database.ref("/players/ryu").once("value").then(
            function (snapshot) {
                //check that no other player has chosen goku
                if (snapshot.val() !== null) {
                    return;
                }
                //handles player1 name selection
                ryu = userNameElement.textContent;

                //update html
                $("#player2").text(ryu);

                //hide instructions
                revealFigthingArena();

                //handles data deletion of player name when player leaves
                database.ref("/players/ryu").onDisconnect().remove();

                //handles data deletion of keypad when player leaves
                database.ref("/keypad").onDisconnect().remove();

                //change what is saved in firebase
                database.ref("/players").update({
                    ryu: ryu
                });

                // Firebase is always watching for changes to the data on the character goku keypad.
                // When changes occurs it will print them to console and html
                database.ref("/keypad/goku/").on("child_added", keyPadInputs, function (errorObject) {
                    console.log("The read failed: " + errorObject.code);
                });

                //make the fake function call the real function
                recordRyusKeyPad = recordRyusKeyPadReal;

                //current fighter
                myFighter = "ryu";
            }
        );
    });
}
// Firebase is always watching for changes to the data on the character goku.
// When changes occurs it will print them to console and html
database.ref("/players/goku").on("value", function (snapshot) {
    //update local variables with database data
    if (snapshot.val() !== null) {
      //handles player1 name updates
      goku = snapshot.val();
      
      //set timer
      maybeStartTimer();

      //update html
      $("#player1").text(goku);
    } else {
        //update html
        $("#player1").text("Player1");

        //reset game when goku is not present
        if (goku !== null) {
            //reset fight arena based on timer running out, declare a winner and don't reset arena
            resetFightArena("Goku Forfeits!", "ryu", true);
        }
    }
    // If any errors are experienced, log them to console.
  }, function(errorObject) {
    console.log("The read failed: " + errorObject.code);
  }
);

// Firebase is always watching for changes to the data on the character ryu.
// When changes occurs it will print them to console and html
database.ref("/players/ryu").on("value", function (snapshot) {
    //update local variables with database data
    if (snapshot.val() !== null) {
      //handles player2 name updates
      ryu = snapshot.val();

      //set timer
      maybeStartTimer();

      //update html
      $("#player2").text(ryu);
    } else {
        //update html
        $("#player2").text("Player2");

        //reset game when ryu is not present
        if (ryu !== null) {
            //reset fight arena based on timer running out, declare a winner and don't reset arena
            resetFightArena("Ryu Forfeits!", "goku", true);
        }
    }
    // If any errors are experienced, log them to console.
  }, function(errorObject) {
    console.log("The read failed: " + errorObject.code);
  }
);

//look out for both players to be in the game and start the timer
function maybeStartTimer() {
  //start timer
  if (ryu !== null && goku !== null) {
    //handles timer
    countdown.reset();
    countdown.start();
  }
}
//sets who won
database.ref("/wins/").on("value", function (snapshot) {
    //whenever win count changes the html gets updated
    if (snapshot.val() === null) {
        return;
    }

    //update html
    $("#gokuWinCount").text(snapshot.val().goku);
    $("#ryuWinCount").text(snapshot.val().ryu);
});

//show fighting arena
function revealFigthingArena() {
  //shows healthbar
  $("#healthBar").removeClass("d-none");

  //shows goku sprite
  $("#gokuSprite").removeClass("d-none");

  //shows ryu sprite
  $("#ryuSprite").removeClass("d-none");

  //hide instructions again
  $("#content").addClass("d-none");

  //remove keypad data
  database.ref("/keypad/").remove();
}

//records key ups
function recordGokusKeyPadReal(keyType, keyCode) {
  //change what is saved in firebase
  database.ref("/keypad/goku/").push({
    keyType: keyType,
    keyCode: keyCode
  });
}

//this is a fake function
function recordGokusKeyPad(keyType, keyCode) {}

//records keys
function recordRyusKeyPadReal(keyType, keyCode) {
  //change what is saved in firebase
  database.ref("/keypad/ryu/").push({
    keyType: keyType,
    keyCode: keyCode
  });
}

//this is a fake function
function recordRyusKeyPad(keyType, keyCode) {}

//receives key pad inputs
function keyPadInputs(snapshot) {
    // dispatch keyboard events
    document.dispatchEvent(new KeyboardEvent(snapshot.val().keyType, { 'keyCode': snapshot.val().keyCode }));
}

//reset function
function resetFightArena(message, winner, fullReset) {
    //reset characters values
    goku = null;
    ryu = null;

    //stop timer
    countdown.stop();

    //makes the current fighter still standing the winner
    if (myFighter === winner && !fullReset) {
        //read current value
        database.ref("/wins/").once("value").then(function (snapshot) {
            //holds current winner
            let tempWinner = winner;

            //holds current wins
            let tempWins = snapshot.val();

            //updates current wins for each player
            if (tempWins === null) {
                tempWins = {
                    goku: 0,
                    ryu: 0
                };
            }

            //wins are increased
            tempWins[winner] += 1;

            //update database
            database.ref("/wins/").update(tempWins);
        });

        //add user to leaderboard and update the number of times they have won
        database.ref("/leaderboard/" + userNameElement.textContent).transaction(function (currentValue) {
            //initialize current user data for the leaderboard
            let newValue = (currentValue || {
                count: 0,
                profilePicUrl: getProfilePicUrl()
            });

            // increment win count
            newValue.count++;

            //new leaderboard data
            return newValue;
        });
    }

  //removes win count for players
  if (fullReset) {
    database.ref("/wins/").remove();
  }
  
  //showcase victories and forfeits messages
  $("#displayMessage").text(message);

  //unhide message area
  $("#displayMessage").removeClass("d-none");

  //remove healthbar
  $("#healthBar").addClass("d-none");

  //remove goku sprite
  $("#gokuSprite").addClass("d-none");

  //remove ryu sprite
  $("#ryuSprite").addClass("d-none");

  //remove instructions again
  $("#content").removeClass("d-none");
  
  //clear choices
  setTimeout(function () {
    //cancels onDisconnect Handler
    database.ref("/players/goku").onDisconnect().cancel();

    //cancels onDisconnect Handler
    database.ref("/players/ryu").onDisconnect().cancel();

    //remove keypad data
    database.ref("/keypad/").remove();

    //remove players
    database.ref("/players/").remove();

    //reset game healthbars
    healthbar.resetGame();

    //reset goku's keypad
    recordGokusKeyPad = function() {};

    //reset ryu's keypad
    recordRyusKeyPad = function() {};

    //removes all callbacks for goku
    database.ref("/keypad/goku/").off();

    //removes all callbacks for ryu
    database.ref("/keypad/ryu/").off();

    //reset goku positioning
    $("#gokuSprite").removeAttr("style");
    
    //reset ryu positioning
    $("#ryuSprite").removeAttr("style");

    //show leaderboard data
    $("#leaderBoard").removeClass("d-none");

    //hide instructions
    $("#userInstructions").addClass("d-none");

    //hide leaderboard again
    setTimeout(function () {
      //show leaderboard data
      $("#leaderBoard").addClass("d-none");

      //hide instructions
      $("#userInstructions").removeClass("d-none");
    }, 5000);
  }, 5000);
}

// coundown object
var countdown = {
    //countdown time initialized
    time: 59,

    //resets countdown
    reset: function () {
        //resets countdown time
        countdown.time = 59;

        //change the html to read the current countdown time
        $("#countDown").text("59");

    },
  
    //starts the countdown
    start: function () {
        // use setInterval to start the count here and set the clock to running.
        if (!clockRunning) {
            //start countdown
            intervalId = setInterval(countdown.count, 1000);

            //the countdown has started
            clockRunning = true;
        }
    },
  
    //stops countdown
    stop: function () {
        // use clearInterval to stop the count here and set the clock to not be running.
        //reset interval
        clearInterval(intervalId);

        //stop the countdown
        clockRunning = false;
    },
  
    //keep track of the countdown
    count: function () {
        // decrease time by 1
        countdown.time--;

        // update html with the current countdown
        $("#countDown").text(countdown.time);

        //if count <= 0 then the countdown has reached the end, declare a winner of the round and restart the counter
        if (countdown.time <= 0) {
            //stop countdown
            countdown.stop();

            //intialize the winner
            let winner = "";

            //figure out who the winner is
            if (curHitPointsGoku > curHitPointsRyu) {
                //goku is the winner
                winner = "goku";
            } else if (curHitPointsGoku === curHitPointsRyu) {
                //tie case
                winner = null;
            } else {
                //ryu is the winner
                winner = "ryu";
          }
          //reset fight arena based on timer running out, declare a winner and don't reset arena
          resetFightArena("Time Up!", winner, false);
        }
    }
};

//sets leaderboard
database.ref("/leaderboard/").on("value", function (snapshot) {
    //delete the leaderboard items
    $("#leaderBoardList").empty();

    //initialize leaderboard data
    let leaderBoardData = snapshot.val();

    //iterates over user object
    for (let user in leaderBoardData) {
        //make a list of users in the leaderboard
        $("#leaderBoardList").append("<li> <img class='userLeaderBoard img-fluid' src='" + leaderBoardData[user].profilePicUrl + "' /> " + user + " " + leaderBoardData[user].count + "</li>");
    }
});


// ==================
//     GOKU GAMEPAD
// ==================
$(document).keydown(function(event) {
  if (!$("#collapseExample").hasClass("show")) {
    //comment out this collisionBox object after testing
    collisionQuery.checkContact();

    switch (event.which) {
      // user presses the "A" PUNCH key
      case 65:
        //database call to record the press of the keytype and the keycode
        recordGokusKeyPad("keydown", 65);
        playPunch();
        $(".goku").removeClass("goku-idle");
        $(".goku").removeClass("idle-p1");
        $(".goku").addClass("goku-punch");
        $(".goku").addClass("punch-p1");
        setTimeout(function(e) {
          $(".goku").removeClass("punch-p1");
          $(".goku").removeClass("goku-punch");
          $(".goku").addClass("goku-idle");
          $(".goku").addClass("idle-p1");
        }, 570);
        break;

      // user presses the "S" KICK key
      case 83:
        //database call to record the press of the keytype and the keycode
        recordGokusKeyPad("keydown", 83);
        playCross();
        $(".goku").addClass("kick-p1");
        $(".goku").addClass("goku-kick");
        setTimeout(function(e) {
          $(".goku").removeClass("kick-p1");
          $(".goku").removeClass("goku-kick");
        }, 530);
        break;

      // user presses the "D" JUMP key
      case 68:
        //database call to record the press of the keytype and the keycode
        recordGokusKeyPad("keydown", 68);
        playJump();
        $(".goku").removeClass("goku-idle");
        $(".goku").removeClass("idle-p1");
        $(".goku").addClass("goku-jump");
        $(".goku").addClass("jump-p1");
        setTimeout(function(e) {
          $(".goku").addClass("goku-idle");
          $(".goku").addClass("idle-p1");
          $(".goku").removeClass("jump-p1");
          $(".goku").removeClass("goku-jump");
        }, 400);
        break;
    }
  }
});

// ==================
//     RYU GAMEPAD
// ==================
$(document).keydown(function(event) {
  if (!$("#collapseExample").hasClass("show")) {
    //comment out this collisionTester object after testing
    collisionQuery.checkContact();

    switch (event.which) {
      // user presses the "j" PUNCH key
      case 74:
        //database call to record the press of the keytype and the keycode
        recordRyusKeyPad("keydown", 74);
        playPunch();
        $(".ryu").removeClass("ryu-idle");
        $(".ryu").removeClass("idle-p2");
        $(".ryu").addClass("ryu-punch");
        $(".ryu").addClass("punch-p2");
        setTimeout(function(event) {
          $(".ryu").addClass("ryu-idle");
          $(".ryu").addClass("idle-p2");
          $(".ryu").removeClass("punch-p2");
          $(".ryu").removeClass("ryu-punch");
        }, 230);
        break;

      // user presses the "k" KICK key
      case 75:
        //database call to record the press of the keytype and the keycode
        recordRyusKeyPad("keydown", 75);
        playCross();
        $(".ryu").addClass("ryu-kick");
        $(".ryu").addClass("kick-p2");
        setTimeout(function(event) {
          $(".ryu").removeClass("kick-p2");
          $(".ryu").removeClass("ryu-kick");
        }, 600);
        break;

      // user presses the "l" JUMP key
      case 76:
        //database call to record the press of the keytype and the keycode
        recordRyusKeyPad("keydown", 76);
        playJump();
        $(".ryu").addClass("ryu-jump");
        $(".ryu").addClass("jump-p2");
        setTimeout(function(event) {
          $(".ryu").removeClass("jump-p2");
          $(".ryu").removeClass("ryu-jump");
        }, 370);
        break;
    }
  }
});

// =============
//    WALKING
// =============

var walk = {
  goku: $(".goku"),
  ryu: $(".ryu"),
  speed: 2,
  gokuLeftKeyToggle: false,
  gokuRightKeyToggle: false,
  ryuLeftKeyToggle: false,
  ryuRightKeyToggle: false,

  keyDown: $(document).keydown(function(event) {
    var keycode = event.keyCode;
    if (keycode === 81) {
      walk.gokuLeftKeyToggle = true;
      //database call to record the press of the keytype and the keycode
      recordGokusKeyPad("keydown", keycode);
    }
    if (keycode === 69) {
      walk.gokuRightKeyToggle = true;
      recordGokusKeyPad("keydown", keycode);
    }
    if (keycode === 85) {
      walk.ryuLeftKeyToggle = true;
      playHadouken();
      recordRyusKeyPad("keydown", keycode);
    }
    if (keycode === 79) {
      walk.ryuRightKeyToggle = true;
      recordRyusKeyPad("keydown", keycode);
    }
  }),
  keyUp: $(document).keyup(function(event) {
    var keycode = event.keyCode;
    if (keycode === 81) {
      walk.gokuLeftKeyToggle = false;
      recordGokusKeyPad("keyup", keycode);
    }
    if (keycode === 69) {
      walk.gokuRightKeyToggle = false;
      recordGokusKeyPad("keyup", keycode);
    }
    if (keycode === 85) {
      walk.ryuLeftKeyToggle = false;
      recordRyusKeyPad("keyup", keycode);
    }
    if (keycode === 79) {
      walk.ryuRightKeyToggle = false;
      recordRyusKeyPad("keyup", keycode);
    }
  }),
  animateGo: $(document).keydown(function() {
    if (walk.gokuLeftKeyToggle == true || walk.gokuRightKeyToggle == true) {
      walk.goku.addClass("goku-walk walk-p1");
    }
    if (walk.ryuLeftKeyToggle == true || walk.ryuRightKeyToggle == true) {
      walk.ryu.addClass("ryu-walk walk-p2");
    }
  }),
  animateStop: $(document).keyup(function() {
    if (walk.gokuLeftKeyToggle == false || walk.gokuRightKeyToggle == false) {
      walk.goku.removeClass("goku-walk walk-p1");
    }
    if (walk.ryuLeftKeyToggle == false || walk.ryuRightKeyToggle == false) {
      walk.ryu.removeClass("ryu-walk walk-p2");
    }
  }),
  moveGoku: function() {
    var charposition = walk.goku.position().left;
    if (walk.gokuLeftKeyToggle)
      walk.goku.css("left", charposition - walk.speed + "px");
    if (walk.gokuRightKeyToggle)
      walk.goku.css("left", charposition + walk.speed + "px");
  },
  moveRyu: function() {
    var charposition = walk.ryu.position().left;
    if (walk.ryuLeftKeyToggle)
      walk.ryu.css("left", charposition - walk.speed + "px");
    if (walk.ryuRightKeyToggle)
      walk.ryu.css("left", charposition + walk.speed + "px");
  }
};
setInterval(walk.moveGoku, 1);
setInterval(walk.moveRyu, 1);



// =============
//    collision-healthbar- hitbox.js can be found here
// =============

// ===================
//   COLLISION BOX
// ===================
var collisionBox = {
  ifHasContact: function(collisionBoxOne, collisionBoxTwo) {
    var collisionBox1 = $(collisionBoxOne);
    var collisionBox2 = $(collisionBoxTwo);

    //collisionBox1 contact dimenstions
    var collisionBox1x = collisionBox1.offset().left;
    var collisionBox1y = collisionBox1.offset().top;
    var collisionBox1w = collisionBox1.width();
    var collisionBox1h = collisionBox1.height();

    //collisionBox2 contact dimensions
    var collisionBox2x = collisionBox2.offset().left;
    var collisionBox2y = collisionBox2.offset().top;
    var collisionBox2w = collisionBox2.width();
    var collisionBox2h = collisionBox2.height();

    if (
      collisionBox1y + collisionBox1h < collisionBox2y ||
      collisionBox1y > collisionBox2y + collisionBox2h ||
      collisionBox1x > collisionBox2x + collisionBox2w ||
      collisionBox1x + collisionBox1w < collisionBox2x
    ) {
      return false;
    } else {
      return true;
    }
  }
};

// ====================
// COLLISION QA TESTING
// ====================
// //Comment out what you want to see: colors, logs, or both
var collisionQA = {
  logGokuCollision: function() {
    // $(".goku").css({ backgroundColor: "green" });
    $(".goku").css({ backgroundColor: "none" });
    // console.log('Goku hitbox: ', hitbox);
  },
  logGokuSafe: function() {
    // $(".goku").css({ backgroundColor: "red" });
    $(".goku").css({ backgroundColor: "none" });
  },
  logRyuCollision: function() {
    // $(".ryu").css({ backgroundColor: "yellow" });
    $(".ryu").css({ backgroundColor: "none" });
    // console.log('Ryu hitbox: ', hitbox);
  },
  logRyuSafe: function() {
    // $(".ryu").css({ backgroundColor: "blue" });
    $(".ryu").css({ backgroundColor: "none" });
  },
  hitBoxCheck: $(window).keydown(function() {
    if (collision === true) {
      console.log("collision confirmed: ", collision);
      return collision;
    }
  })
};

// ==========================
//   COLLISION CONFIRMATION
// ==========================
var collision = false;
var hitbox = false;

var collisionQuery = {
  gokuCollisionPositive: function() {
    collision = true;
    hitbox = true;
    // collisionQA.logGokuCollision();
  },
  gokuCollisionNegative: function() {
    collision = false;
    hitbox = false;
    // collisionQA.logGokuSafe();
  },
  ryuCollisionPositive: function() {
    collision = true;
    hitbox = true;
    // collisionQA.logRyuCollision();
  },
  ryuCollisionNegative: function() {
    collision = false;
    hitbox = false;
    // collisionQA.logRyuSafe();
  },
  checkContact: function() {
    $(".collision-p1").each(function() {
      if (collisionBox.ifHasContact(".collision-p2", $(this))) {
        collisionQuery.gokuCollisionPositive();
      } else {
        collisionQuery.gokuCollisionNegative();
      }
    });
    $(".collision-p2").each(function() {
      if (collisionBox.ifHasContact(".collision-p1", $(this))) {
        collisionQuery.ryuCollisionPositive();
      } else {
        collisionQuery.ryuCollisionNegative();
      }
    });
  }
};

//==================
//    HEALTHBAR
//==================
let maxHitPoints = 0, curHitPointsGoku = maxHitPoints, curHitPointsRyu = maxHitPoints;
// let maxHitPoints = 0, curHitPoints = maxHitPoints;
var healthbar = {
  generateHitPoints: function() {
    maxHitPoints = 100;
    $(".maxHitPoints").text(maxHitPoints);
  },
  assignDamageValue: function() {
    $(".gamePad").each(function() {
      var damageValue = 10;
      $(this).val(damageValue);
    });
  },
  // countDamage: function(userSelection) {
  //   damage = +$(userSelection).val();
  //   $(".damage").text(damage);
  // },
  applyDamageRyu: function(curHitPoints) {
    //Removes a correct percentage ratio of hitpoints when
    //applying different amounts of damage
    var hpToPercentRatio = curHitPoints * (100 / maxHitPoints);
    $(".health-bar-text-p2").html(curHitPoints + " HP");
    $(".health-bar-red-p2").animate(
      {
        width: hpToPercentRatio + "%"
      },
      700
    );
    $(".health-bar-p2").animate(
      {
        width: hpToPercentRatio + "%"
      },
      500
    );
  },
  applyDamageGoku: function(curHitPoints) {
    //Removes a correct percentage ratio of hitpoints when
    //applying different amounts of damage
    var hpToPercentRatio = curHitPoints * (100 / maxHitPoints);
    $(".health-bar-text").html(curHitPoints + " HP");
    $(".health-bar-red").animate(
      {
        width: hpToPercentRatio + "%"
      },
      700
    );
    $(".health-bar").animate(
      {
        width: hpToPercentRatio + "%"
      },
      500
    );
  },
  resetHealthBar: function() {
    //Goku
    curHitPointsGoku = maxHitPoints;
    $(".health-bar-text").html(curHitPointsGoku + " HP");
    $(".health-bar-red").css("width", "100%");
    $(".health-bar").css("width", "100%");
    //RYU
    curHitPointsRyu = maxHitPoints;
    $(".health-bar-text-p2").html(curHitPointsRyu + " HP");
    $(".health-bar-red-p2").css("width", "100%");
    $(".health-bar-p2").css("width", "100%");
  },
  resetGame: function() {
    this.generateHitPoints();
    this.assignDamageValue();
    $(".damage").text(" ");
    this.resetHealthBar();
  }
};

var eventHandlers = {
  // damageMonitor: function() {
  //   healthbar.countDamage(this);
  // },
  applyDamageRyu: function(damage) {
    curHitPointsRyu = curHitPointsRyu - damage;
    healthbar.applyDamageRyu(curHitPointsRyu);
    //reset the fighting arena when ryu has been defeated
    if(curHitPointsRyu <= 0){resetFightArena("Goku Wins!", "goku", false);}
  },
  applyDamageGoku: function(damage) {
    curHitPointsGoku = curHitPointsGoku - damage;
    healthbar.applyDamageGoku(curHitPointsGoku);
    //reset the fighting arena when goku has been defeated
    if(curHitPointsGoku <= 0){resetFightArena("Ryu Wins!", "ryu", false);}
  },
  intializeGameClick: $(".newGame").click(function() {
    this.intializeGame();
  }),
  intializeGame: function() {
    healthbar.resetGame();
    $(".health-bar-text").html(curHitPointsGoku + " HP");
    $(".health-bar-text-p2").html(curHitPointsRyu + " HP");
  }
};
eventHandlers.intializeGame();

// ==================
// HITBOX QA TESTING
// ==================

var hitboxQA = {
  gokuPunch: function() {
    // $(".goku").css("background-color", "orange");
    $(".goku").css("background-color", "none");
  },
  gokuKick: function() {
    // $(".goku").css("background-color", "orange");
    $(".goku").css("background-color", "none");
  },
  ryuPunch: function() {
    // $(".ryu").css("background-color", "purple");
    $(".ryu").css("background-color", "none");
  },
  ryuKick: function() {
    // $(".ryu").css("background-color", "purple");
    $(".ryu").css("background-color", "none");
  }
};

// =============
//    HIT BOX
// =============
$(document).keydown(function(event) {
  switch (event.which) {
    //GOKU HIT DETECT
    //user presses the "A" PUNCH key
    case 65:
      if (collision && hitbox) {
        hitboxQA.gokuPunch();
        eventHandlers.applyDamageRyu(5);
        $(".ryu").addClass("ryu-damaged damaged-p2");
      }
      break;
    // user presses the "S" KICK key
    case 83:
      if (collision && hitbox) {
        hitboxQA.gokuKick();
        eventHandlers.applyDamageRyu(10);
        $(".ryu").addClass("ryu-damaged damaged-p2");
      }
      break;

    //RYU HIT DETECT
    //user presses the "J" PUNCH key
    case 74:
      if (collision && hitbox) {
        hitboxQA.ryuPunch();
        eventHandlers.applyDamageGoku(5);
        $(".goku").addClass("goku-damaged damaged-p1");
      }
      break;
    // user presses the "K" KICK key
    case 75:
      if (collision && hitbox) {
        hitboxQA.ryuKick();
        eventHandlers.applyDamageGoku(10);
        $(".goku").addClass("goku-damaged damaged-p1");
      }
      break;
  }
});

$(document).keyup(function(event) {
  switch (event.which) {
    //GOKU DAMAGE DETECT
    //user presses the "A" PUNCH key
    case 65:
      if (collision && hitbox) {
        setTimeout(function(event) {
          $(".ryu").removeClass("ryu-damaged damaged-p2");
        }, 150);
        break;
      }
      break;
    // user presses the "S" KICK key
    case 83:
      if (collision && hitbox) {
        setTimeout(function(event) {
          $(".ryu").removeClass("ryu-damaged damaged-p2");
        }, 150);
        break;
      }
      break;

    //RYU DAMAGE DETECT
    //user presses the "J" PUNCH key
    case 74:
      if (collision && hitbox) {
        setTimeout(function(event) {
          $(".goku").removeClass("goku-damaged damaged-p1");
        }, 100);
      }
      break;
    // user presses the "K" KICK key
    case 75:
      if (collision && hitbox) {
        setTimeout(function(event) {
          $(".goku").removeClass("goku-damaged damaged-p1");
        }, 100);
      }
      break;
  }
});
