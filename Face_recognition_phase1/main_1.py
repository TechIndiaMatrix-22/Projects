import cv2
import mediapipe as mp
from keras_facenet import FaceNet

from camera import VideoStream
from register import register_person
from recognize import detect_and_recognize

# ---------------------------------
# Fast / Far + Near Face Detector
# ---------------------------------
detector = mp.solutions.face_detection.FaceDetection(
    model_selection=1,
    min_detection_confidence=0.45
)

# ---------------------------------
# FaceNet Embedder
# ---------------------------------
embedder = FaceNet()

# ---------------------------------
# Camera Starts First
# ---------------------------------
stream = VideoStream(0).start()

mode = "idle"

# ---------------------------------
# Performance Buffers
# ---------------------------------
frame_counter = 0
cached_results = []

# ---------------------------------
# Window
# ---------------------------------
cv2.namedWindow(
    "Face System",
    cv2.WINDOW_NORMAL
)

cv2.resizeWindow(
    "Face System",
    1280,
    720
)

# =================================
# MAIN LOOP
# =================================
while True:

    frame = stream.read()

    if frame is None:
        continue

    frame = cv2.flip(frame, 1)

    # ---------------------------------
    # DETECT MODE
    # ---------------------------------
    if mode == "detect":

        frame_counter += 1

        # Heavy AI every 5th frame
        if frame_counter % 5 == 0:

            _, cached_results = detect_and_recognize(
                frame,
                detector,
                embedder
            )

        # Draw cached results every frame
        for x1,y1,x2,y2,name,score in cached_results:

            color = (
                (0,255,0)
                if name != "Unknown"
                else (0,0,255)
            )

            # Bigger box
            pad_w = int((x2-x1) * 0.08)
            pad_h = int((y2-y1) * 0.08)

            xx1 = max(0, x1 - pad_w)
            yy1 = max(0, y1 - pad_h)
            xx2 = x2 + pad_w
            yy2 = y2 + pad_h

            cv2.rectangle(
                frame,
                (xx1,yy1),
                (xx2,yy2),
                color,
                2
            )

            cv2.putText(
                frame,
                f"{name}",
                (xx1, yy1-10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.78,
                color,
                2
            )

    # ---------------------------------
    # BLUE UI
    # ---------------------------------
    cv2.putText(
        frame,
        "R:Register  D:Detect  I:Idle  Q:Quit",
        (20,30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.78,
        (255,0,0),
        2
    )

    cv2.imshow(
        "Face System",
        frame
    )

    key = cv2.waitKey(1) & 0xFF

    # ---------------------------------
    # CONTROLS
    # ---------------------------------
    if key == ord("q"):
        break

    elif key == ord("r"):

        mode = "idle"

        register_person(
            stream,
            detector,
            embedder
        )

        cached_results = []

    elif key == ord("d"):

        mode = "detect"

    elif key == ord("i"):

        mode = "idle"

# ---------------------------------
# EXIT
# ---------------------------------
stream.stop()
cv2.destroyAllWindows()