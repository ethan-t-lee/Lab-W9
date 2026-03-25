from flask import Flask, request, jsonify, render_template
from google.cloud import firestore
import firebase_admin
from firebase_admin import auth
import os

app = Flask(__name__)
db = firestore.Client()

# Initialize Firebase Admin once
if not firebase_admin._apps:
    firebase_admin.initialize_app()

@app.route("/")
def index():
    return render_template("index.html")

def verify_token_and_get_uid():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        print("Missing or invalid Authorization header")
        return None

    id_token = auth_header.split("Bearer ")[1]

    try:
        decoded_token = auth.verify_id_token(id_token)
        print("Decoded UID:", decoded_token["uid"])
        return decoded_token["uid"]
    except Exception as e:
        print("Token verification failed:", str(e))
        return None

@app.route("/api/tasks", methods=["POST"])
def create_task():
    uid = verify_token_and_get_uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json(silent=True) or {}
        print("POST data:", data)
        print("UID:", uid)

        title = data.get("title", "").strip()
        priority = data.get("priority", "medium")

        if not title:
            return jsonify({"error": "Title required"}), 400

        task_ref = db.collection("users").document(uid).collection("tasks").document()
        task_ref.set({
            "title": title,
            "done": False,
            "priority": priority,
            "createdAt": firestore.SERVER_TIMESTAMP
        })

        print("Created task:", task_ref.id)
        return jsonify({"id": task_ref.id, "message": "Task created"}), 201

    except Exception as e:
        print("POST /api/tasks error:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    uid = verify_token_and_get_uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        tasks = db.collection("users").document(uid).collection("tasks").stream()

        result = []
        for t in tasks:
            data = t.to_dict() or {}

            if "createdAt" in data and data["createdAt"] is not None:
                try:
                    data["createdAt"] = data["createdAt"].isoformat()
                except Exception:
                    data["createdAt"] = str(data["createdAt"])

            result.append({"id": t.id, **data})

        return jsonify(result), 200

    except Exception as e:
        print("GET /api/tasks error:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks/<task_id>", methods=["PATCH"])
def update_task(task_id):
    uid = verify_token_and_get_uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json(silent=True) or {}
        task_ref = db.collection("users").document(uid).collection("tasks").document(task_id)

        updates = {}
        if "done" in data:
            updates["done"] = bool(data["done"])
        if "priority" in data:
            updates["priority"] = data["priority"]
        if "title" in data:
            title = str(data["title"]).strip()
            if title:
                updates["title"] = title

        if not updates:
            return jsonify({"error": "No valid fields to update"}), 400

        task_ref.update(updates)
        return jsonify({"message": "Task updated"}), 200

    except Exception as e:
        print("PATCH /api/tasks error:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    uid = verify_token_and_get_uid()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        task_ref = db.collection("users").document(uid).collection("tasks").document(task_id)
        task_ref.delete()
        return jsonify({"message": "Task deleted"}), 200

    except Exception as e:
        print("DELETE /api/tasks error:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)