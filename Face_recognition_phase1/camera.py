import cv2
import threading


class VideoStream:
    def __init__(self, src=0):

        self.cap = cv2.VideoCapture(
            src,
            cv2.CAP_DSHOW
        )

        self.cap.set(
            cv2.CAP_PROP_FRAME_WIDTH,
            1280
        )

        self.cap.set(
            cv2.CAP_PROP_FRAME_HEIGHT,
            720
        )

        self.cap.set(
            cv2.CAP_PROP_FPS,
            30
        )

        self.cap.set(
            cv2.CAP_PROP_BUFFERSIZE,
            1
        )

        self.frame = None
        self.lock = threading.Lock()
        self.stopped = False

    def start(self):

        threading.Thread(
            target=self.update,
            daemon=True
        ).start()

        return self

    def update(self):

        while not self.stopped:

            ok, frame = self.cap.read()

            if ok:
                with self.lock:
                    self.frame = frame

    def read(self):

        with self.lock:

            if self.frame is None:
                return None

            return self.frame.copy()

    def stop(self):

        self.stopped = True
        self.cap.release()