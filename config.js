import * as firebase from "firebase";
require("@firebase/firestore");

var firebaseConfig = {
  apiKey: "AIzaSyA0n66l0M-jubfo7Hw90DHjuoCUzSd1U-k",
  authDomain: "wily-app-22615.firebaseapp.com",
  databaseURL: "https://wily-app-22615.firebaseio.com",
  projectId: "wily-app-22615",
  storageBucket: "wily-app-22615.appspot.com",
  messagingSenderId: "23750432413",
  appId: "1:23750432413:web:61064b91047cfe67bc6674",
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

export default firebase.firestore();
