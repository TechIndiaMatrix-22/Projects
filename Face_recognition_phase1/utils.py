import os
import pickle
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

DB_FILE = "database.pkl"


def set_database(name):

    global DB_FILE

    name = name.strip()

    if not name:
        name = "database"

    if not name.endswith(".pkl"):
        name += ".pkl"

    DB_FILE = name

    print("Using:", DB_FILE)


def load_db():

    if os.path.exists(DB_FILE):

        with open(DB_FILE, "rb") as f:
            return pickle.load(f)

    return {}


def save_db(db):

    with open(DB_FILE, "wb") as f:
        pickle.dump(db, f)


def add_embedding(name, emb):

    db = load_db()

    if name not in db:
        db[name] = []

    db[name].append(
        np.array(
            emb,
            dtype=np.float32
        )
    )

    save_db(db)


def recognize_face(
    emb,
    threshold=0.72
):

    db = load_db()

    if len(db) == 0:
        return "Unknown", 0.0

    emb = np.array(
        emb,
        dtype=np.float32
    )

    best_name = "Unknown"
    best_score = -1

    for name, vectors in db.items():

        for ref in vectors:

            score = cosine_similarity(
                [emb],
                [ref]
            )[0][0]

            if score > best_score:
                best_score = score
                best_name = name

    if best_score >= threshold:
        return best_name, float(best_score)

    return "Unknown", float(best_score)