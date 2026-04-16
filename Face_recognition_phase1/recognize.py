"""import cv2
import os
import time
from utils import recognize_face

UNKNOWN_DIR = "Unknown_faces"

os.makedirs(
    UNKNOWN_DIR,
    exist_ok=True
)

last_save = 0
SAVE_GAP = 5


def save_unknown(face):

    global last_save

    now = time.time()

    if now - last_save < SAVE_GAP:
        return

    cv2.imwrite(
        os.path.join(
            UNKNOWN_DIR,
            f"unknown_{int(now)}.jpg"
        ),
        face
    )

    last_save = now


def detect_and_recognize(
    frame,
    detector,
    embedder
):

    h,w,_ = frame.shape

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    results = detector.process(rgb)

    output = []

    if not results.detections:
        return frame, output

    for det in results.detections:

        box = det.location_data.relative_bounding_box

        x1 = max(0, int(box.xmin*w))
        y1 = max(0, int(box.ymin*h))
        x2 = min(w, x1 + int(box.width*w))
        y2 = min(h, y1 + int(box.height*h))

        crop = frame[y1:y2, x1:x2]

        if crop.size == 0:
            continue

        try:
            face = cv2.resize(
                crop,
                (160,160)
            )

            emb = embedder.embeddings(
                [face]
            )[0]

            name, score = recognize_face(
                emb
            )

            if name == "Unknown":
                save_unknown(face)

            output.append(
                (
                    x1,y1,x2,y2,
                    name,
                    score
                )
            )

        except:
            pass

    return frame, output"""

import cv2
import os
import time
from utils import recognize_face

UNKNOWN_DIR = "Unknown_faces"
os.makedirs(UNKNOWN_DIR, exist_ok=True)

last_save = 0
SAVE_GAP = 5

# -----------------------------
# Sticky memory
# -----------------------------
last_name = "Unknown"
last_score = 0
last_seen = 0

HOLD_TIME = 1.0   # seconds


def save_unknown(face):
    global last_save

    now = time.time()

    if now - last_save < SAVE_GAP:
        return

    cv2.imwrite(
        os.path.join(
            UNKNOWN_DIR,
            f"unknown_{int(now)}.jpg"
        ),
        face
    )

    last_save = now


def detect_and_recognize(
    frame,
    detector,
    embedder
):
    global last_name
    global last_score
    global last_seen

    h, w, _ = frame.shape

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    results = detector.process(rgb)

    output = []

    if not results.detections:
        return frame, output

    now = time.time()

    for det in results.detections:

        box = det.location_data.relative_bounding_box

        x1 = max(0, int(box.xmin * w))
        y1 = max(0, int(box.ymin * h))
        x2 = min(w, x1 + int(box.width * w))
        y2 = min(h, y1 + int(box.height * h))

        crop = frame[y1:y2, x1:x2]

        if crop.size == 0:
            continue

        try:
            face = cv2.resize(crop, (160,160))

            emb = embedder.embeddings([face])[0]

            # Slightly easier threshold for far faces
            area = (x2-x1) * (y2-y1)

            if area < 30000:
                name, score = recognize_face(
                    emb,
                    threshold=0.66
                )
            else:
                name, score = recognize_face(
                    emb,
                    threshold=0.72
                )

            # ---------------------
            # Sticky stabilization
            # ---------------------
            if name != "Unknown":
                last_name = name
                last_score = score
                last_seen = now

            else:
                # Hold previous label briefly
                if now - last_seen < HOLD_TIME:
                    name = last_name
                    score = last_score

            if name == "Unknown":
                save_unknown(face)

            output.append(
                (
                    x1,y1,x2,y2,
                    name,score
                )
            )

        except:
            pass

    return frame, output