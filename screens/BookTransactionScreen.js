import React from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ToastAndroid,
  Alert,
} from "react-native";
import * as Permissions from "expo-permissions";
import { BarCodeScanner } from "expo-barcode-scanner";
import * as firebase from "firebase";
import db from "../config.js";

export default class TransactionScreen extends React.Component {
  constructor() {
    super();
    this.state = {
      hasCameraPermissions: null,
      scanned: false,
      scannedBookId: "",
      scannedStudentId: "",
      buttonState: "normal",
      transactionMessage: "",
    };
  }

  getCameraPermissions = async (id) => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);

    this.setState({
      /*status === "granted" is true when user has granted permission
          status === "granted" is false when user has not granted the permission
        */
      hasCameraPermissions: status === "granted",
      buttonState: id,
      scanned: false,
    });
  };

  handleBarCodeScanned = async ({ type, data }) => {
    const { buttonState } = this.state;

    if (buttonState === "BookId") {
      this.setState({
        scanned: true,
        scannedBookId: data,
        buttonState: "normal",
      });
    } else if (buttonState === "StudentId") {
      this.setState({
        scanned: true,
        scannedStudentId: data,
        buttonState: "normal",
      });
    }
  };

  initiateBookIssue = async () => {
    //add a transaction
    db.collection("transactions").add({
      studentId: this.state.scannedStudentId,
      bookId: this.state.scannedBookId,
      date: firebase.firestore.Timestamp.now().toDate(),
      transactionType: "Issue",
    });
    //change book status
    db.collection("books").doc(this.state.scannedBookId).update({
      bookAvailability: false,
    });
    //change number  of issued books for student
    db.collection("students")
      .doc(this.state.scannedStudentId)
      .update({
        numberOfBooksIssued: firebase.firestore.FieldValue.increment(1),
      });

    this.setState({ scannedBookId: "", scannedStudentId: "" });
  };

  initiateBookReturn = async () => {
    //add a transaction
    db.collection("transactions").add({
      studentId: this.state.scannedStudentId,
      bookId: this.state.scannedBookId,
      date: firebase.firestore.Timestamp.now().toDate(),
      transactionType: "Return",
    });
    //change book status
    db.collection("books").doc(this.state.scannedBookId).update({
      bookAvailability: true,
    });
    //change number  of issued books for student
    db.collection("students")
      .doc(this.state.scannedStudentId)
      .update({
        numberOfBooksIssued: firebase.firestore.FieldValue.increment(-1),
      });

    this.setState({ scannedBookId: "", scannedStudentId: "" });
  };

  handleTransaction = async () => {
    console.log("Book Id: " + this.state.scannedBookId);
    console.log("Student Id: " + this.state.scannedStudentId);
    var transactionType = await this.checkBookEligibity();
    if (!transactionType) {
      Alert.alert("The book doesn't exist in the library database.");
      // ToastAndroid.show(
      //   "The book doesn't exist in the library database.",
      //   ToastAndroid.SHORT
      // );
      this.setState({
        scannedBookId: "",
        scannedStudentId: "",
      });
    } else if (transactionType === "Issue") {
      var isStudentEligibile = await this.checkStudentEligibilityForBookIssue();
      if (isStudentEligibile) {
        this.initiateBookIssue();
        Alert.alert("Book issued to the student!");
        // ToastAndroid.show("Book issued to the student!", ToastAndroid.SHORT);
      }
    } else {
      var isStudentEligibile = await this.checkStudentEligibilityForBookReturn();
      if (isStudentEligibile) {
        this.initiateBookReturn();
        Alert.alert("Book returned to the library!");
        // ToastAndroid.show("Book returned to the library!", ToastAndroid.SHORT);
      }
    }
  };

  checkStudentEligibilityForBookIssue = async () => {
    console.log("in checkStudentEligibilityForBookIssue....");
    var isStudentEligibile = null;
    const studentRef = await db
      .collection("students")
      .where("studentId", "==", this.state.scannedStudentId)
      .get();

    if (studentRef.docs.length == 0) {
      console.log("no student found....");
      isStudentEligibile = false;
      Alert.alert("The student id doesn't exist in the database!");
      this.setState({ scannedBookId: "", scannedStudentId: "" });
      // ToastAndroid.show(
      //   "The student id doesn't exist in the database!",
      //   ToastAndroid.SHORT
      // );
    } else {
      studentRef.docs.map((doc) => {
        console.log("found student....");
        var student = doc.data();
        if (student.numberOfBooksIssued < 2) {
          isStudentEligibile = true;
        } else {
          console.log("not eligible as 2 books already taken....");
          isStudentEligibile = false;
          Alert.alert("The student has already issued 2 books!");
          // ToastAndroid.show(
          //   "The student has already issued 2 books!",
          //   ToastAndroid.SHORT
          // );
          this.setState({ scannedBookId: "", scannedStudentId: "" });
        }
      });
    }
    return isStudentEligibile;
  };

  checkStudentEligibilityForBookReturn = async () => {
    console.log("in checkStudentEligibilityForBookReturn....");
    var isStudentEligibile = null;
    const transactionRef = await db
      .collection("transactions")
      .where("bookId", "==", this.state.scannedBookId)
      .limit(1)
      .get();

    transactionRef.docs.map((doc) => {
      console.log("got data for book return....");
      var lastBookTransaction = doc.data();
      if (lastBookTransaction.studentId == this.state.scannedStudentId) {
        isStudentEligibile = true;
      } else {
        console.log("student not eligible....");
        isStudentEligibile = false;
        Alert.alert("The book wasn't issue by this student!");
        // ToastAndroid.show(
        //   "The book wasn't issue by this student!",
        //   ToastAndroid.SHORT
        // );
        this.setState({ scannedBookId: "", scannedStudentId: "" });
      }
    });
    return isStudentEligibile;
  };

  checkBookEligibity = async () => {
    console.log("in checkBookEligibility....");
    var transactionType = "";
    const bookRef = await db
      .collection("books")
      .where("bookId", "==", this.state.scannedBookId)
      .get();

    if (bookRef.docs.length == 0) {
      console.log("no books found....");
      transactionType = false;
      console.log(bookRef.docs.length);
    } else {
      bookRef.docs.map((doc) => {
        console.log("book found....");
        var book = doc.data();
        if (book.bookAvailability) {
          transactionType = "Issue";
        } else {
          transactionType = "Return";
        }
      });
    }
    return transactionType;
  };

  render() {
    const hasCameraPermissions = this.state.hasCameraPermissions;
    const scanned = this.state.scanned;
    const buttonState = this.state.buttonState;

    if (buttonState !== "normal" && hasCameraPermissions) {
      return (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      );
    } else if (buttonState === "normal") {
      return (
        <View style={styles.container}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              style={styles.container}
              behavior="padding"
              enabled
            >
              <View>
                <Image
                  source={require("../assets/booklogo.jpg")}
                  style={{ width: 200, height: 200 }}
                />
                <Text style={{ textAlign: "center", fontSize: 30 }}>Wily</Text>
              </View>
              <View style={styles.inputView}>
                <TextInput
                  style={styles.inputBox}
                  placeholder="Book Id"
                  onChangeText={(text) =>
                    this.setState({ scannedBookId: text })
                  }
                  value={this.state.scannedBookId}
                />
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={() => {
                    this.getCameraPermissions("BookId");
                  }}
                >
                  <Text style={styles.buttonText}>Scan</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputView}>
                <TextInput
                  style={styles.inputBox}
                  placeholder="Student Id"
                  onChangeText={(text) =>
                    this.setState({ scannedStudentId: text })
                  }
                  value={this.state.scannedStudentId}
                />
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={() => {
                    this.getCameraPermissions("StudentId");
                  }}
                >
                  <Text style={styles.buttonText}>Scan</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={async () => {
                  var transactionMessage = this.handleTransaction();
                  //this.setState({ scannedBookId: "", scannedStudentId: "" });
                }}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  displayText: {
    fontSize: 15,
    textDecorationLine: "underline",
  },
  scanButton: {
    backgroundColor: "#2196F3",
    padding: 10,
    margin: 10,
  },
  buttonText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 10,
  },
  inputView: {
    flexDirection: "row",
    margin: 20,
  },
  inputBox: {
    width: 200,
    height: 40,
    borderWidth: 1.5,
    borderRightWidth: 0,
    fontSize: 20,
  },
  scanButton: {
    backgroundColor: "#66BB6A",
    width: 50,
    borderWidth: 1.5,
    borderLeftWidth: 0,
  },
  submitButton: {
    backgroundColor: "#FBC02D",
    width: 100,
    height: 50,
  },
  submitButtonText: {
    padding: 10,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
});
