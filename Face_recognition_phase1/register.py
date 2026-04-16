import cv2
import os
import threading
import queue
from utils import add_embedding

FACES_DIR = "Faces"
os.makedirs(FACES_DIR, exist_ok=True)


def save_worker(q, folder):

    while True:

        item = q.get()

        if item is None:
            break

        idx, img = item

        cv2.imwrite(
            os.path.join(folder, f"{idx}.jpg"),
            img
        )

        q.task_done()


def register_person(stream, detector, embedder):

    name = input("Enter name: ").strip()

    if not name:
        return

    folder = os.path.join(FACES_DIR, name)
    os.makedirs(folder, exist_ok=True)

    q = queue.Queue()

    threading.Thread(
        target=save_worker,
        args=(q, folder),
        daemon=True
    ).start()

    count = 0
    frame_id = 0

    while count < 120:

        frame = stream.read()

        if frame is None:
            continue

        frame = cv2.flip(frame, 1)
        frame_id += 1

        rgb = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        if frame_id % 2 == 0:

            results = detector.process(rgb)

            if results.detections:

                det = results.detections[0]

                h, w, _ = frame.shape
                box = det.location_data.relative_bounding_box

                x1 = max(0, int(box.xmin * w))
                y1 = max(0, int(box.ymin * h))
                x2 = min(w, x1 + int(box.width * w))
                y2 = min(h, y1 + int(box.height * h))

                crop = frame[y1:y2, x1:x2]

                if crop.size != 0:

                    try:
                        face = cv2.resize(
                            crop,
                            (160,160)
                        )

                        emb = embedder.embeddings(
                            [face]
                        )[0]

                        add_embedding(name, emb)

                        q.put(
                            (
                                count,
                                face.copy()
                            )
                        )

                        count += 1

                    except:
                        pass

        cv2.putText(
            frame,
            f"{name}: {count}/120",
            (20,40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0,255,0),
            2
        )

        cv2.imshow(
            "Face System",
            frame
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            q.put(None)
            return

    q.join()
    q.put(None)

    print(f"{name} registered.")