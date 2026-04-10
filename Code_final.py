## Stage 1:
import sys
path = r"C:\Users\DELL\Face_detect_lib"
if path not in sys.path:
    sys.path.insert(0, path)
    print("Successfully inserted. Go ahead.")
else:
    print("Path already present. Go ahead.")

##Stage2:
# installation of libraries.
"""!pip install opencv-python"""
"""!pip install numpy"""
#Verification of dlib
import dlib
import face_recognition

print("dlib:", dlib.__version__)
print("face_recognition loaded", face_recognition.__version__)

##Stage 3:
#capture photo/images of people.
import cv2
import os

name = input("Enter person name: ")
save_path = f"People/{name}"

os.makedirs(save_path, exist_ok=True)

cap = cv2.VideoCapture(0)
count = 0

print("Press ENTER to capture")
print("Press q to quit")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    cv2.imshow("Capture - ENTER to click | q to quit", frame)

    key = cv2.waitKey(30) & 0xFF

    # ENTER to capture
    if key == 13:
        img_name = f"{save_path}/{count}.jpg"
        cv2.imwrite(img_name, frame)
        print("Saved:", img_name)
        count += 1

    # q to quit
    if key == ord('q'):
        break

    # window closed
    if cv2.getWindowProperty("Capture - ENTER to click | q to quit",
                             cv2.WND_PROP_VISIBLE) < 1:
        break

cap.release()
cv2.destroyAllWindows()

print(f"Total images saved: {count}")

##Stage 4:
#Run the recognizer.py
import os
print(os.listdir("People/YASH"))
print('\n')
print(os.listdir("People/VINCY"))

## Stage5: Loading dataset of people
import face_recognition
import cv2
import os
import numpy as np

known_encodings = []
known_names = []

dataset_path = "People"

print("Loading dataset...")

for person in os.listdir(dataset_path):
    person_path = os.path.join(dataset_path, person)

    if not os.path.isdir(person_path):
        continue

    for image in os.listdir(person_path):
        img_path = os.path.join(person_path, image)

        if not image.lower().endswith((".jpg",".png",".jpeg")):
            continue

        img = face_recognition.load_image_file(img_path)
        enc = face_recognition.face_encodings(img)

        if len(enc) > 0:
            known_encodings.append(enc[0])
            known_names.append(person)

print("Loaded:", known_names)

## Stage 6: HOG + Distance_matching
# HOG + Distance matching.
"""Disadvantages:
1. works under few people.
2. sometimes the system becomes unstable."""

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        small_frame = cv2.resize(frame, (0,0), fx=0.5, fy=0.5)
        rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        #case1:
        locations = face_recognition.face_locations(rgb, model="hog")
        #case2:
        #locations = face_recognition.face_locations(rgb, model="cnn") #issue of cnn is its very slow. but better accurcay than hog
        encodings = face_recognition.face_encodings(rgb, locations)

        for (top, right, bottom, left), face_encoding in zip(locations, encodings):

            face_distances = face_recognition.face_distance(known_encodings, face_encoding)
            best_match_index = np.argmin(face_distances)

            name = "Unknown"
            if face_distances[best_match_index] < 0.6:
                name = known_names[best_match_index]

            top *= 2
            right *= 2
            bottom *= 2
            left *= 2

            cv2.rectangle(frame,(left,top),(right,bottom),(0,255,0),2)
            cv2.putText(frame,name,(left,top-10),
                        cv2.FONT_HERSHEY_SIMPLEX,0.8,(0,255,0),2)

        cv2.imshow("Face Recognition", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    pass

cap.release()
cv2.destroyAllWindows()

#Or
## HOG+SVM
import face_recognition
import cv2
import os
import numpy as np
from sklearn import svm

encodings = []
names = []

dataset_path = "People"

print("Loading dataset...")

for person in os.listdir(dataset_path):
    person_path = os.path.join(dataset_path, person)

    if not os.path.isdir(person_path):
        continue

    for image in os.listdir(person_path):

        img_path = os.path.join(person_path, image)

        if not image.lower().endswith((".jpg",".png",".jpeg")):
            continue

        img = face_recognition.load_image_file(img_path)

        boxes = face_recognition.face_locations(img, model="hog")
        face_enc = face_recognition.face_encodings(img, boxes)

        for enc in face_enc:
            encodings.append(enc)
            names.append(person)

print("Training SVM...")

clf = svm.SVC(kernel='linear', probability=True)
clf.fit(encodings, names)

print("Training complete")

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

process_this_frame = True
face_locations = []
face_names = []

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        small = cv2.resize(frame, (0,0), fx=0.5, fy=0.5)
        rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

        # run heavy recognition only every alternate frame
        if process_this_frame:

            boxes = face_recognition.face_locations(rgb, model="hog")
            face_enc = face_recognition.face_encodings(rgb, boxes)

            face_locations = boxes
            face_names = []

            for enc in face_enc:

                probs = clf.predict_proba([enc])[0]
                best_index = np.argmax(probs)
                confidence = probs[best_index]

                name = "No person found"

                if confidence > 0.60:
                    name = clf.classes_[best_index]

                face_names.append(name)

        process_this_frame = not process_this_frame

        # draw every frame (smooth)
        for (top, right, bottom, left), name in zip(face_locations, face_names):

            top *= 2
            right *= 2
            bottom *= 2
            left *= 2

            cv2.rectangle(frame,(left,top),(right,bottom),(0,255,0),2)
            cv2.putText(frame,name,(left,top-10),
                        cv2.FONT_HERSHEY_SIMPLEX,0.8,(0,255,0),2)

        if len(face_locations) == 0:
            cv2.putText(frame,"No person found",(20,40),
                        cv2.FONT_HERSHEY_SIMPLEX,1,(0,0,255),2)

        cv2.imshow("HOG + SVM Face Recognition", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    pass

cap.release()
cv2.destroyAllWindows()