import React, { useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; 

function TestFirebase() {

  useEffect(() => {

    const fetchData = async () => {

      try {

        const querySnapshot = await getDocs(
          collection(db, "attendance")
        );

        querySnapshot.forEach((doc) => {
          console.log(doc.id, doc.data());
        });

        alert("Firebase Connected Successfully");

      } catch (error) {
        console.error(error);
      }
    };

    fetchData();

  }, []);

  return (
    <div>
      <h1>Testing Firebase Connection</h1>
    </div>
  );
}

export default TestFirebase;