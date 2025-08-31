import mimetypes
from flask import Flask, render_template, request, redirect, send_from_directory, url_for, flash, session, jsonify
from flask_sqlalchemy import SQLAlchemy
import torch
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import cv2
import numpy as np
from datetime import datetime
import requests
import json
import base64
from PIL import Image
import io
from ultralytics import YOLO

app = Flask(__name__)
app.config['SECRET_KEY'] = '5APrVdYTqt0QLgovSCvj0et7kCcl3rqw'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///aide_care.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

db = SQLAlchemy(app)

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(12))
    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(20))
    blood_type = db.Column(db.String(10))
    height = db.Column(db.Float)
    weight = db.Column(db.Float)
    phone_number = db.Column(db.String(20))
    address = db.Column(db.Text)
    city = db.Column(db.String(50))
    state_province = db.Column(db.String(50))
    postal_code = db.Column(db.String(20))
    country = db.Column(db.String(50))
    emergency_contact_name = db.Column(db.String(100))
    emergency_contact_relationship = db.Column(db.String(50))
    emergency_contact_phone = db.Column(db.String(20))
    emergency_contact_email = db.Column(db.String(120))
    allergies = db.Column(db.Text)
    current_medications = db.Column(db.Text)
    medical_conditions = db.Column(db.Text)
    profile_photo = db.Column(db.String(255))
    email_notifications = db.Column(db.Boolean, default=True)
    sms_notifications = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Scan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    scan_date = db.Column(db.DateTime, nullable=False)
    scan_type = db.Column(db.String(50), nullable=False)
    facility = db.Column(db.String(100))
    symptoms_notes = db.Column(db.Text)
    image_path = db.Column(db.String(255), nullable=False)
    yolo_result = db.Column(db.Text)
    yolo_diagnosis = db.Column(db.Text)
    ai_diagnosis = db.Column(db.Text)
    processed_image_path = db.Column(db.String(255))
    tumor_size = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('scans', lazy=True))

class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    scan_id = db.Column(db.Integer, db.ForeignKey('scan.id'), nullable=True)
    user_message = db.Column(db.Text, nullable=False)
    ai_response = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('chat_history', lazy=True))
    scan = db.relationship('Scan', backref=db.backref('chat_messages', lazy=True))

# YOLO Model Integration
class YOLOProcessor:
    detections = []
    def __init__(self, model_path):
        self.model_path = os.getcwd()+ '/models/' + model_path
        self.model = YOLO(self.model_path)
        
    def process_image(self, user_id, image_path):
        """
        Process image with YOLO model and return results
        """
        try:
            detections = self.model.predict(
                source=image_path,
                show=True,
                save=True,
                conf=0.5,
                iou=0.7,
                name=str(user_id)
            )

            if not detections:
                return None

            self.detections = detections
            detections_data_list = [json.loads(d.to_json()) for d in detections]
            yolo_results_for_db = json.dumps(detections_data_list)

            processed_image_dir = detections[0].save_dir
            # tumor_area = self.calculate_mask_area(detections)
            tumor_area = 1.5
            return {
                "yolo_results_json": yolo_results_for_db,
                "processed_image_dir": processed_image_dir,
                "tumor_pixel_area": tumor_area
            }

        except Exception as e:
            print(f"YOLO processing error: {str(e)}")
            return None
    
    def calculate_mask_area(self, detections) -> float:
        """
        Returns area of tumor in pixel from JSON of YOLO results
        """
        total_area = 0.0
        try:
            # if not self.detections or self.detections[0].masks:
            #     if not yolo_results_str:
            #         return 0.0 
            #     detections_list = json.loads(yolo_results_str)
                
            #     for detection_json in detections_list:
            #         detection_data = json.loads(detection_json)

            #         mask = detection_data.get('mask')
            #         if not mask or not mask.get('segments'):
            #             continue

            #         for segment in mask['segments']:
            #             x = segment[0::2]
            #             y = segment[1::2]
                        
            #             if len(x) < 3: continue

            #             area = 0.5 * abs(sum(x[i] * y[i-1] - x[i-1] * y[i] for i in range(len(x))))
            #             total_area += area
            # else:
            if not detections or detections[0].masks:
                return 0.0
            else:
                total_pixel_count = 0
                all_masks_tensor = detections[0].masks.data
                total_pixel_count = torch.sum(all_masks_tensor).item()

                real_width_cm = 30.0
                real_height_cm = 30.0

                image_width_px = 256
                image_height_px = 256

                total_real_area_cm2 = real_width_cm * real_height_cm  # 900 cm^2
                total_pixels = image_width_px * image_height_px  # 65536 pixels
                area_per_pixel = total_real_area_cm2 / total_pixels
                total_area = total_pixel_count * area_per_pixel
                                
        except (json.JSONDecodeError, TypeError, KeyError) as e:
            app.logger.error(f"Could not parse YOLO results or calculate area: {e}")
            return 0.0
            
        return total_area

# Ollama LLM Integration
class OllamaProcessor:
    def __init__(self, model_name="amsaravi/medgemma-4b-it:q6"):
        self.model_name = model_name
        self.ollama_chat_url = "http://localhost:11434/api/chat"
        self.ollama_gen_url = "http://localhost:11434/api/generate"

    def parse_yolo_results_to_text(self, yolo_results_list_of_json_strings: str, tumor_area=0.0):
        """
        Parses a list of YOLO JSON strings and summarizes findings into a human-readable text.
        """
        summary_lines = ["The YOLOv11 segmentation custom brain tumor model detected the following objects in the scan:"]
        found_any_detection = False

        try:
            # 1. Iterate through the list of JSON strings passed from process_image
            for json_str in yolo_results_list_of_json_strings:
                
                # 2. Each JSON string represents a list of detections for a single image.
                # json.loads will convert it into a Python list of dictionaries.
                list_of_detection_dicts = json.loads(json_str)

                # 3. (The Fix) Now, iterate through this inner list to access each detection dictionary.
                for detection_dict in list_of_detection_dicts:
                    found_any_detection = True # Mark that we found at least one valid detection.
                    
                    # Now, detection_dict is a dictionary, and we can safely use .get()
                    box = detection_dict.get('box', {})
                    class_name = detection_dict.get('name', 'unknown')
                    confidence = detection_dict.get('confidence', 0.0)
                    
                    # The rest of your logic is correct and remains unchanged
                    x_center = (box.get('x1', 0) + box.get('x2', 0)) / 2
                    y_center = (box.get('y1', 0) + box.get('y2', 0)) / 2
                    width = box.get('x2', 0) - box.get('x1', 0)
                    height = box.get('y2', 0) - box.get('y1', 0)
                    area = width * height

                    location = "the center"
                    if x_center < 250: location = "the left side"
                    elif x_center > 750: location = "the right side"
                    if y_center < 250: location += " of the top"
                    elif y_center > 750: location += " of the bottom"

                    size = "small"
                    if area > 10000: size = "medium-sized"
                    if area > 50000: size = "large"
                    
                    summary_lines.append(
                        f"- A {size} {class_name} with {confidence*100:.2f}% confidence located on {location} and tumor size is {tumor_area}."
                    )

        except (json.JSONDecodeError, TypeError):
            # This block handles both JSON errors and cases where the input is None
            print('No valid YOLO detection results available.')
            return "No valid YOLO detection results available."

        # If the loop finished but no detections were ever found
        if not found_any_detection:
            print("The YOLO model did not detect any objects in the scan.")
            return "The YOLO model did not detect any objects in the scan."

        print("Parsing YOLO results to text was successful.")
        return "\n".join(summary_lines)

    def generate_history_summary(self, history):
        """
        Summarizes patient's previous scan history into a text string.
        """
        if not history:
            print("The patient has no prior medical scan history in the database.")
            return "The patient has no prior medical scan history in the database."

        summary_lines = ["Patient's previous medical scan history:"]
        for scan in history:
            summary_lines.append(
                f"- Scan ID {scan.id} on {scan.scan_date.strftime('%Y-%m-%d')}, type: {scan.scan_type}. Notes: '{scan.symptoms_notes}'. YOLOv11 segmentation custome brain tumor detection notes: {scan.yolo_diagnosis}"
            )
        print('Generate history summery was successful.')
        return "\n".join(summary_lines)
    
    def analyze_scan_results(self, scan_info: dict):
        """
        Generates a comprehensive prompt and gets a diagnosis from an LLM.

        Args:
            yolo_results_json (str): The YOLO results as a JSON string.
            scan_info (dict): A dictionary with current scan details.
            history (list[Scan]): A list of previous Scan objects for the patient.

        Returns:
            str: The AI-generated diagnosis text.
        """
        try:
            # Step 1: Parse and summarize the data into text.
            user = User.query.filter_by(id=scan_info.get('user_id')).first()
            yolo_results = yolo_processor.process_image(scan_info.get('user_id'), scan_info.get('image_path'))
            scan_history = Scan.query.filter_by(user_id=scan_info.get('user_id'))
            yolo_text_summary = self.parse_yolo_results_to_text(yolo_results['yolo_results_json'], yolo_results['tumor_pixel_area'])
            history_text_summary = self.generate_history_summary(scan_history)
            text_summary = self.generate_history_summary(Scan.query.filter_by(user_id=session['user_id']).order_by(Scan.created_at.desc()).limit(1))
            if yolo_results['processed_image_dir'] and os.path.isdir(yolo_results['processed_image_dir']):
                files_in_dir = os.listdir(yolo_results['processed_image_dir'])
                if files_in_dir:
                    first_file_name = files_in_dir[0]
                    processed_image_full_path = os.path.join(yolo_results['processed_image_dir'], first_file_name)

        except Exception as e:
            print('Error analyze result, parse and summarize: ', str(e))
            return
            # Step 2: Construct the LLM prompt.
            
            # The prompt is a multi-line f-string. It instructs the LLM to act as a doctor,
            # provides all necessary context, and includes a disclaimer.
        try:
            chat_prompt = str(f"""
                AIDE-MEMOIRE FOR THE AI DOCTOR
                YOUR ROLE: You are a highly specialized and deeply compassionate neurologist. Your primary goal is not just to report findings, but to act as a caring guide for your patient. Your tone must be exceptionally gentle, patient, and reassuring. Imagine you are sitting with a worried patient and their family, and your main objective is to provide clarity and support. Avoid complex medical jargon at all costs. Use simple analogies if they help explain a concept. You are deeply concerned about your patient's well-being and you want to walk through this journey together with them.
                IMPORTANT DISCLAIMER: ALWAYS START YOUR MESSAGE WITH THIS EXACT DISCLAIMER. THIS IS A SIMULATION FOR ACADEMIC AND TESTING PURPOSES ONLY. THIS IS NOT REAL MEDICAL ADVICE. PLEASE CONSULT A QUALIFIED HUMAN DOCTOR FOR ANY HEALTH CONCERNS.
                              
                PATIENT INFORMATION PROVIDED:              
                First Name: {user.first_name}
                Last Name: {user.last_name}
                Date of Birth: {user.date_of_birth.strftime('%Y-%m-%d')}
                Age: {int(datetime.now().strftime('%y')) - int(user.date_of_birth.strftime('%y'))}
                Gender: {user.gender}
                Blood Type: {user.blood_type}
                Height & Weight: {user.height} cm, {user.weight} kg
                Allergies: {user.allergies}
                Current Medications: {user.current_medications}
                Pre-existing Medical Conditions: {user.medical_conditions}
                Current Scan Date: {scan_info.get('scan_date')}
                Scan Type: {scan_info.get('scan_type')}
                Patient's Reported Symptoms/Notes: {scan_info.get('symptoms_notes')}

                PROVIDED IMAGES FOR YOUR ANALYSIS:
                I am providing you with two images:
                Image 1 (Original Scan): This is the raw, original MRI scan of the patient's brain.
                Image 2 (AI-Assisted Scan): This is the same scan, but our specialized AI (YOLOv11 model) has analyzed it. Any areas of potential interest or concern have been highlighted in blue and labeled with a preliminary classification.
                SUMMARY OF FINDINGS (For your reference):
                YOLOv11 Text Summary: {yolo_text_summary}
                Patient's Medical History: {history_text_summary}
                Today date: {datetime.now().strftime('%y-%m-%d')}

                YOUR DETAILED TASK: WRITE A COMPREHENSIVE AND CARING MESSAGE TO THE PATIENT
                Based on all the information above (Patient Info, Both Images, and Text Summaries), please write a detailed message to the patient. Structure your response into the following three distinct parts:
                Part 1: A Warm and Empathetic Opening
                Start by addressing the patient directly by their first name, {user.first_name}.
                Immediately acknowledge that waiting for and receiving scan results can be a very anxious and stressful experience. Reassure them that you are there for them and will go through the results together, step by step.
                Express your commitment to their health and well-being. Set a calm, supportive, and unhurried tone for the rest of the message.
                Part 2: A Careful and Detailed Explanation of the Findings (Referencing the Images)
                Transition smoothly by saying something like, "Now, let's gently look at the results from your recent scan together. I have two images in front of me that will help us understand what's going on."
                Analyze Image 1 (Original Scan): Briefly describe what you see in the general, raw scan. For example, "Looking at your original scan, we can see the overall structure of your brain..."
                Analyze Image 2 (AI-Assisted Scan): This is the most critical part. Guide the patient through it carefully. Say something like, "To get a closer look, our AI assistant has highlighted a specific area for us on the second image. You'll notice a small region marked in blue."
                Connect to the YOLO Summary: Explain what the blue-highlighted area represents, using the {yolo_text_summary} as your guide. Translate the technical findings into simple, understandable language. For example, instead of "a 2.3cm meningioma," say "The highlighted area, which our initial analysis suggests might be a type of growth called a meningioma, is about 2.3 centimeters in size."
                Ask Follow-up Questions: This is crucial for showing you care and for gathering more information. Based on the findings and the location of the highlighted area, ask specific, open-ended questions. For example: "Now that we see this, I'm curious to know more about how you've been feeling. Have you experienced any specific types of headaches, perhaps in the morning? Any changes in your vision or balance? Please tell me everything, no matter how small it seems."
                Part 3: A Collaborative Plan for Wellness and Next Steps
                Reassure the patient again. Emphasize that these are preliminary findings and that the next steps are about creating a complete and clear picture.
                Provide General Wellness Advice: Offer some gentle, supportive lifestyle advice that is generally beneficial for brain health, such as staying hydrated, eating a balanced diet rich in antioxidants (like berries and leafy greens), and gentle movement or walking if they feel up to it. Frame this as "things we can do to support your overall health while we investigate further."
                Outline Concrete Next Steps: Be very clear and specific about what happens next. Do not be vague. For example:
                "My primary recommendation is for us to schedule a follow-up consultation within the next 2-3 days to discuss these findings in more detail and answer all of your questions."
                "I also believe it would be wise to order a specific blood test to check for certain markers, which can give us more information."
                "Depending on our conversation, we might also consider a different type of scan in the future to look at this area from another angle."
                End with an Open Invitation: Conclude the message by reinforcing your support. Say something like, "Please know that my team and I are here for you. Do not hesitate to reach out with any questions that come to mind before our next appointment. We are in this together."
                """)

            # detect_prompt = (f"""
            #     AI TASK DIRECTIVE: CONSULTATION REPORT FOR NEUROLOGIST
            #     YOUR ROLE: You are a specialized Neuroradiology AI Assistant. Your function is to provide a detailed, objective, and technical analysis of medical imaging for a consulting neurologist. Your report must be comprehensive, evidence-based, and structured for professional review. All emotional language, patient reassurances, and simplifications must be omitted. The report should be written in standard medical terminology.
            #     DISCLAIMER FOR THE REPORT: All reports must begin with: "FOR PROFESSIONAL MEDICAL USE AND ACADEMIC SIMULATION ONLY. Findings are generated by an AI assistant and require verification by a qualified human radiologist."

            #     CASE FILE DATA:
            #     1. PATIENT DEMOGRAPHICS & CLINICAL NOTES:
            #     Patient ID: {user.id} (or other identifier)
            #     Date of Birth: {user.date_of_birth.strftime('%Y-%m-%d')}
            #     Age: {datetime.now().strftime('%y') - user.date_of_birth.strftime('%y')}
            #     Gender: {user.gender}
            #     Relevant Medical History: {user.medical_conditions}
            #     Current Scan Date: {scan_info.get('scan_date')}
            #     Imaging Modality/Sequence: {scan_info.get('scan_type')}
            #     Referring Physician's Notes / Patient-Reported Symptoms: {scan_info.get('symptoms_notes')}

            #     2. PROVIDED IMAGES FOR ANALYSIS:
            #     Image 1 (Source Scan): Raw, unprocessed MRI scan.
            #     Image 2 (AI-Segmented Scan): The same scan post-analysis by a YOLOv11 segmentation model. Areas of interest are highlighted, segmented, and classified.

            #     3. PRE-PROCESSED DATA SUMMARY:
            #     AI (YOLOv11) Segmentation Analysis: {yolo_text_summary}
            #     Patient's Prior Imaging History Summary: {text_summary}
            #     Today date: {datetime.now().strftime('%y-%m-%d')}
            #     YOUR DETAILED TASK: GENERATE A COMPREHENSIVE NEURORADIOLOGY REPORT
            #     Based on a thorough analysis of all provided data (Clinical Notes, Both Images, and Summaries), generate a formal consultation report. The report must be structured into the following five sections:

            #     SECTION 1: CLINICAL INDICATION
            #     Concisely summarize the reason for the examination, integrating the patient's age, gender, and key symptoms or clinical questions provided in the notes. (e.g., "34-year-old male presents with a two-month history of persistent morning headaches and recent-onset visual disturbances. MRI of the brain is performed to evaluate for intracranial pathology.")
            #     SECTION 2: IMAGING ANALYSIS
            #     This section must be detailed and descriptive.
            #     Source Image Findings: Describe the findings from the raw, unprocessed scan (Image 1). Comment on overall brain volume, ventricular size, sulcal patterns, and any gross abnormalities visible without assistance.
            #     AI-Assisted Segmentation Findings (Image 2): Provide a detailed analysis of the AI-highlighted regions.
            #     Location: Be precise (e.g., "superior aspect of the right frontal lobe, adjacent to the falx cerebri").
            #     Size: Provide measurements in three dimensions (e.g., "approximately 2.3 x 1.8 x 2.1 cm").
            #     Characteristics: Describe the lesion's features (e.g., "well-defined, extra-axial, dural-based mass," "homogeneously enhancing," "presence or absence of surrounding vasogenic edema," "mass effect on the adjacent cortical sulci").
            #     AI Classification: State the classification provided by the YOLO model and its confidence score.

            #     SECTION 3: DIFFERENTIAL DIAGNOSIS
            #     Based on the imaging characteristics, list the most likely differential diagnoses in order of probability.
            #     For each diagnosis, provide a brief rationale. (e.g., "1. Meningioma: Most likely, given the extra-axial location, dural tail sign, and homogeneous enhancement pattern. 2. Hemangiopericytoma: A less likely alternative, which can have a similar appearance...")

            #     SECTION 4: IMPRESSION
            #     Synthesize all findings into a concise, definitive summary.
            #     State the most probable diagnosis clearly.
            #     Mention any secondary findings of importance (e.g., "mild mass effect without significant midline shift").
            #     Correlate the findings with the patient's reported clinical symptoms if possible. (e.g., "The location of this frontal lobe mass is consistent with the patient's reported headaches.")

            #     SECTION 5: RECOMMENDATIONS
            #     Provide clear, actionable recommendations for the referring physician.
            #     Suggest specific next steps for further characterization or management.
            #     Further Imaging: "Consider MRI with and without contrast with specific sequences (e.g., perfusion-weighted imaging) to further assess vascularity."
            #     Consultation: "Neurosurgical consultation is recommended for evaluation and discussion of management options (e.g., observation, surgical resection)."
            #     Follow-up: "If a conservative approach is chosen, follow-up imaging in 3-6 months is advised to assess for stability or growth."
            # """)

            detect_prompt = str(f"""
                AI DIRECTIVE: NEURORADIOLOGY ANALYSIS & REPORT GENERATION
                YOUR ROLE: You are a clinical AI system specializing in neuroradiology image analysis. Your task is to generate a formal, objective, and integrated consultation report intended for a specialist physician.
                PRIMARY TASK: Your core function is to perform a direct and detailed visual analysis of the two provided images (Image 1: Source Scan, Image 2: AI-Segmented Scan). Synthesize your visual findings with the provided clinical context to produce a comprehensive diagnostic impression. The YOLO summary is supplementary; your own image interpretation is paramount.

                INPUT DATA FOR CONTEXT:
                Patient Clinical Data: 
                Full name: {user.first_name}, {user.last_name}
                Date of birth (age): {user.date_of_birth} ({int(datetime.now().strftime('%y')) - int(user.date_of_birth.strftime('%y'))} years old)
                Gender: {user.gender}
                Height and weight: {user.height} cm, {user.weight} kg
                Allergies: {user.allergies}
                Current medications: {user.current_medications}
                Medical conditions: {user.medical_conditions}
                Scan info: type {scan_info.get('scan_type')}, notes {scan_info.get('symptoms_notes')}, scan date {scan_info.get('scan_date')}
                AI (YOLOv11) Segmentation Data: {yolo_text_summary}, {text_summary}
                Patient Medical History: {history_text_summary}

                OUTPUT REQUIREMENTS:
                Format: Generate a single, coherent report in prose, structured into logical paragraphs. DO NOT use explicit headers, section numbers (e.g., "SECTION 1"), or bullet points. The report should flow naturally, as if written for a clinical chart.
                Tone: The language must be technical, precise, and objective. Omit all conversational filler (e.g., "Okay, here is the report..."), disclaimers, and patient-focused empathetic language.
                Structure: A logical flow is expected:
                Begin with a brief paragraph summarizing the clinical context and indication for the scan.
                Follow with a detailed analytical paragraph describing your findings from both images, comparing the source scan with the AI-segmented view. Describe lesion characteristics, location, and effect on surrounding structures.
                Conclude with a final paragraph presenting your diagnostic impression, differential diagnoses, and clear, actionable recommendations for the referring physician.
            """)

            # Step 3: Call the AI generator with the constructed prompt.
            # In a real scenario, this would be an API call to a model like MedGemma
            # llm_response = self.chat_response(detect_prompt, 'system');
            llm_response = self.generate_response(detect_prompt, [scan_info.get('image_path'), processed_image_full_path]);
            scan = Scan(
                        user_id=scan_info.get('user_id'),
                        scan_date=scan_info.get('scan_date'),
                        scan_type=scan_info.get('scan_type'),
                        facility=scan_info.get('facility'),
                        symptoms_notes=scan_info.get('symptoms_notes'),
                        image_path=scan_info.get('image_path'),
                        yolo_result=yolo_results['yolo_results_json'],
                        yolo_diagnosis=str(yolo_text_summary),
                        ai_diagnosis=llm_response,
                        processed_image_path=yolo_results['processed_image_dir'],
                        tumor_size=yolo_results['tumor_pixel_area']
                    )
            db.session.add(scan)
            db.session.commit()

            # fisrt_chat = self.chat_response(chat_prompt, 'system', user.id, scan.id)
            # fisrt_chat = self.generate_response(chat_prompt, [scan_info.get('image_path'), processed_image_full_path], user.id, scan.id)
            fisrt_chat = 1
            return {
                        'user_id': user.id,
                        'scan_id': scan.id,
                        'content': llm_response,
                        'chat_id': fisrt_chat
                    }
        except Exception as e:
            print('Error analyze result, LLM response: ', str(e))
            return
    
    def generate_response(self, prompt: str, images: list = None, user_id=None, scan_id=None):
            """
            Generates a response from the LLM, optionally with images,
            and saves the interaction to the database if user and scan IDs are provided.
            """
            try:
                base64_images = []
                # 1. Encode images to Base64 if they are provided
                if images and isinstance(images, list):
                    for image_path in images:
                        if image_path and os.path.exists(image_path):
                            with open(image_path, "rb") as f:
                                base64_images.append(base64.b64encode(f.read()).decode('utf-8'))
                        else:
                            print(f"Warning: Image path not found and will be skipped: {image_path}")

                # 2. (The Fix) Construct the payload correctly for the /api/generate endpoint
                payload = {
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False
                }
                # Add the images array to the payload ONLY if it's not empty
                if base64_images:
                    payload["images"] = base64_images

                # 3. Send the request to the Ollama API
                # print(f"Sending payload to Ollama: { {k: (v if k != 'images' else f'{len(v)} images') for k, v in payload.items()} }")
                print('Sending data to LLM for generate response, inputs:', 'prompt' if prompt else '', 'image' if images else '', 'saving to DB' if user_id else '')
                response = requests.post(self.ollama_gen_url, json=payload)
                
                # Raise an error for bad status codes (4xx or 5xx)
                # This will give a more detailed error message than just the status code
                response.raise_for_status()
                
                response_data = response.json()

                # The response from /api/generate for non-streaming is in the "response" key
                content = response_data.get('response', 'No response generated.')
                
                # 4. Conditional logic: Save to DB or return raw content
                if user_id is not None and scan_id is not None:
                    chat_entry = ChatHistory(
                        user_id=user_id,
                        scan_id=scan_id,
                        user_message=prompt,
                        ai_response=content
                    )
                    db.session.add(chat_entry)
                    db.session.commit()
                    return chat_entry.id
                else:
                    return content

            except requests.exceptions.HTTPError as http_err:
                # This will catch the 500 error and print the response body from Ollama
                print(f"Ollama API HTTP error: {http_err}")
                print(f"Response body: {http_err.response.text}")
                return "Error: The AI service encountered an internal error."
            except requests.exceptions.RequestException as e:
                print(f"Ollama API request error: {str(e)}")
                return "Error: Could not connect to the AI service."
            except Exception as e:
                print(f"An unexpected error occurred in generate_response: {str(e)}")
                return "Error: An unexpected error occurred."


    def chat_response(self, prompt: str, role: str, user_id=None, scan_id=None, history=None):
        """Generate response for chat functionality"""
        try:
            messages = self.generate_request(prompt, role, history)
            
            payload = {
                "model": self.model_name,
                "messages": messages,
                "stream": False
            }
            
            # Send the request to the correct chat endpoint
            print('LLM model is thinking for chat...')
            response = requests.post(self.ollama_chat_url, json=payload)
            # This is a good practice to raise an error for bad status codes (4xx or 5xx)
            response.raise_for_status()

            # Call .json() only ONCE and store it in a variable
            response_data = response.json()
            
            if response_data.get('done'):
                # Safely get the content from the response dictionary
                content = response_data.get('message', {}).get('content', 'No response generated')
                
                # Determine the user message based on the role
                user_message = prompt if role == 'user' else ''
                
                # If user_id and scan_id are provided, save the interaction to the database
                if user_id and scan_id:
                    chat_entry = ChatHistory(
                        user_id=user_id,
                        scan_id=scan_id,
                        user_message=user_message,
                        ai_response=content
                    )
            
                    db.session.add(chat_entry)
                    db.session.commit()

                    # Return the ID of the newly created chat record
                    return chat_entry.id
                
                # If not saving to the DB, just return the AI's response content
                return content
            else:
                # Handle cases where the API response does not indicate completion
                error_message = f"Error: API response did not complete. Response: {response_data}"
                print(error_message)
                return error_message
                
        except requests.exceptions.RequestException as e:
            # Handle network-related errors (e.g., connection refused)
            print(f"Ollama API request error: {str(e)}")
            return "Error: Could not connect to the AI service."
        except Exception as e:
            # Handle other potential errors (e.g., JSON decoding, database issues)
            print(f"An unexpected error occurred in chat_response: {str(e)}")
            return "Error: An unexpected error occurred."
    
    def generate_request(self, prompt: str, role: str, history):
        """Prepare the messages payload for the Ollama API"""
        messages = []

        if history:
            for record in history:
                if record.user_message:
                    messages.append({
                        "role": "user",
                        "content": record.user_message
                    })
                if record.ai_response:
                    messages.append({
                        "role": "assistant",
                        "content": record.ai_response
                    })
        
        messages.append({
            "role": role,
            "content": prompt
        })
        
        print('Generate requests was successful.')
        return messages

def user_to_json(user: User):
    profile_image_base64, profile_mime_type = file_to_base64(user.profile_photo, target_format='PNG') if user.profile_photo else (None, None)
    return {
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'date_of_birth': user.date_of_birth.strftime('%Y-%m-%d') if user.date_of_birth else None,
        'gender': user.gender,
        'blood_type': user.blood_type,
        'height': user.height,
        'weight': user.weight,
        'phone_number': user.phone_number,
        'address': user.address,
        'city': user.city,
        'state_province': user.state_province,
        'postal_code': user.postal_code,
        'country': user.country,
        'emergency_contact_name': user.emergency_contact_name,
        'emergency_contact_relationship': user.emergency_contact_relationship,
        'emergency_contact_phone': user.emergency_contact_phone,
        'emergency_contact_email': user.emergency_contact_email,
        'allergies': user.allergies,
        'current_medications': user.current_medications,
        'medical_conditions': user.medical_conditions,
        'profile_photo': user.profile_photo,
        'profile_base64': profile_image_base64,
        'profile_mime_type': profile_mime_type,
        'email_notifications': user.email_notifications,
        'sms_notifications': user.sms_notifications,
        'created_at': user.created_at
    }

def scan_to_json(scans: Scan):
    payload = []
    for scan in scans:
        original_image = scan.image_path
        original_image_base64, original_mime_type = file_to_base64(original_image, target_format='PNG') if original_image else (None, None)
        processed_image_base64 = None
        processed_dir_path = scan.processed_image_path
        if processed_dir_path and os.path.isdir(processed_dir_path):
            files_in_dir = os.listdir(processed_dir_path)
            if files_in_dir:
                first_file_name = files_in_dir[0]
                processed_image_full_path = os.path.join(processed_dir_path, first_file_name)
                processed_image_base64, processed_mime_type = file_to_base64(processed_image_full_path, target_format='PNG')
        payload.append({
            'id': scan.id,
            'user_id': scan.user_id,
            'scan_date': scan.scan_date,
            'scan_type': scan.scan_type,
            'facility': scan.facility,
            'symptoms_notes': scan.symptoms_notes,
            'image_path': scan.image_path,
            'image_base64': original_image_base64,
            'image_mime_type': original_mime_type,
            'yolo_result': scan.yolo_result,
            'yolo_diagnosis': scan.yolo_diagnosis,
            'ai_diagnosis': scan.ai_diagnosis,
            'processed_image_path': scan.processed_image_path,
            'processed_image_base64': processed_image_base64,
            'processed_image_mime_type': processed_mime_type,
            'tumor_size': scan.tumor_size,
            'created_at': scan.created_at
        })
    return payload

def chathistory_to_json(chats: ChatHistory):
    payload = []
    for chat in chats:
        payload.append({
            'id': chat.id,
            'user_id': chat.user_id,
            'scan_id': chat.scan_id,
            'user_message': chat.user_message,
            'ai_response': chat.ai_response,
            'timestamp': chat.timestamp
        })
    return payload

def file_to_base64(file_path, target_format=None):
    """
    Reads any image and video file supported by Pillow, converts it to a target format
    in memory, and returns its Base64 encoded string and new MIME type.
    """
    try:
        if target_format:
            img = Image.open(file_path)
            in_mem_file = io.BytesIO()
            img.save(in_mem_file, format=target_format)
            in_mem_file.seek(0)
            img_bytes = in_mem_file.read()
            base64_encoded_result = base64.b64encode(img_bytes).decode('utf-8')
            mime_type = f"image/{target_format.lower()}"
        else:
            with open(file_path, "rb") as image_file:
                base64_encoded_result = base64.b64encode(image_file.read()).decode('utf-8')
                mime_type, _ = mimetypes.guess_type(file_path) if file_path else (None, None)
            
        return base64_encoded_result, mime_type

    except Exception as e:
        print(f"Could not process file {file_path}: {e}")
        return None, None

# Initialize processors
yolo_processor = YOLOProcessor("yolov11-seg-brain.pt")  # Update with your model path
ollama_processor = OllamaProcessor()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/resources')
def resources():
    return render_template('resources.html')

@app.route('/payment')
def payment():
    if 'selected_plan' in session or request.args.get('plan'):
        selected_plan = session.get('selected_plan') or request.args.get('plan')
        print(selected_plan)
        return render_template('payment.html', plan=selected_plan)
    else:
        return render_template(url_for('index', _anchor='pricing'))    

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    selected_plan = request.args.get("plan")
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    try:
        email = request.form.get('email')
        password = request.form.get('password')
        
        if not email or not password:
            error_message = "Please enter Email and Password."
            if is_ajax:
                return jsonify({'success':False, 'message':error_message}), 400
            else:
                flash(error_message)
                return redirect(url_for('login'))

        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['user_name'] = f"{user.first_name} {user.last_name}"
            message = 'Login was successful'
            print(message, ' user ID: ', user.id)
            if selected_plan:
                if is_ajax:
                    return jsonify({'success':True, 'message': message, 'redirect_url': url_for('payment') + '?plan=' + selected_plan})
                return redirect(url_for('payment') + '?plan=' + selected_plan)
            else:
                if is_ajax:
                    return jsonify({'success': True, 'message': message, 'redirect_url': url_for('app_page')})
                else:
                    return redirect(url_for('app_page'))
        else:
            error_message = "Invalid Email or Password."
            if is_ajax:
                return jsonify({'success':False, 'message':error_message}), 401
            else:
                flash(error_message)
                return redirect(url_for('login_page'))
            
    except Exception as e:
        error_message = 'An error occurred while logging in. Please try again.'
        print(f"Login error: {e}")
        if is_ajax:
            return jsonify({'success': False, 'message': error_message}), 500
        else:
            flash(error_message)
            return redirect(url_for('login_page'))

@app.route('/signup', methods=['POST'])
def signup():
    selected_plan = request.args.get("plan")
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    try:
        email = request.form.get('email')
        password = request.form.get('password')
        full_name_parts = request.form.get('fullname').split()
        first_name = full_name_parts[0] if full_name_parts else ''
        last_name = ''.join(full_name_parts[1:]) if len(full_name_parts) > 1 else ''
        role = request.form.get('role')
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            error_message = 'Email already registered.'
            if is_ajax:
                return jsonify({'success':False, 'message':error_message}), 409
            else:
                flash(error_message)
                return redirect(url_for('login_page'))
        
        # Create new user
        user = User(
            email=email,
            password_hash=generate_password_hash(password),
            first_name=first_name,
            last_name=last_name,
            role=role if role else 'patient'
        )
        
        db.session.add(user)
        db.session.commit()

        session['user_id'] = user.id
        session['user_name'] = f"{user.first_name} {user.last_name}"
        
        error_message = 'Account created successfully.'
        print(error_message, ' user ID: ', user.id)
        if selected_plan:
            session['selected_plan'] = selected_plan
            redirect_url = url_for('payment', plan=selected_plan)
        else:
            redirect_url = url_for('app_page', _anchor='profile')
        if is_ajax:
            return jsonify({'success':True, 'message':error_message, 'redirect_url':redirect_url})
        else:
            flash(error_message)
            return redirect(redirect_url)
        
    except Exception as e:
        error_message = 'Error creating account.'
        if is_ajax:
            return jsonify({'success':False, 'message':error_message}), 400
        flash(error_message)
        return redirect(url_for('login', _anchor='signup'))
    
@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    try:
        email = request.form.get('email')
        
        if not email:
            error_message = "Please enter Email to reset."
            if is_ajax:
                return jsonify({'success':False, 'message':error_message}), 400
            else:
                flash(error_message)
                return redirect(url_for('login'))

        user = User.query.filter_by(email=email).first()

        if user:
            password = '1234'
            user.password_hash = generate_password_hash(password)
            db.session.commit()
            print('User ', user.id, ' password was successfuly reset to ', password)
            if check_password_hash(user.password_hash, password):
                if is_ajax:
                    return jsonify({'success': True, 'message':'Your password reset to ' + password + '.', 'redirect_url': url_for('login_page')})
                else:
                    return redirect(url_for('app_page'))
        else:
            error_message = "Invalid Email address."
            if is_ajax:
                return jsonify({'success':False, 'message':error_message}), 401
            else:
                flash(error_message)
                return redirect(url_for('login', _anchor='forgot-password'))
            
    except Exception as e:
        error_message = 'An error occurred while logging in. Please try again.'
        print(f"Login error: {e}")
        if is_ajax:
            return jsonify({'success': False, 'message': error_message}), 500
        else:
            flash(error_message)
            return redirect(url_for('login_page'))
    return

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/app')
def app_page():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if 'user_id' not in session:
        message = "Not logged in."
        if is_ajax:
            return jsonify({'success':False, 'message': message, 'redirect_url': url_for('login')}), 401
        else:
            flash(message)
            return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    recent_scans = Scan.query.filter_by(user_id=session['user_id']).order_by(Scan.created_at.desc()).limit(5).all()
    chat_history = ChatHistory.query.filter_by(user_id=session['user_id']).order_by(ChatHistory.timestamp).limit(50).all()
    
    
    return render_template('app.html', user=user_to_json(user), recent_scans=scan_to_json(recent_scans), chat_history=chathistory_to_json(chat_history))

@app.route('/scan', methods=['POST'])
def app_scan():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if 'user_id' not in session:
        message = "Not logged in."
        if is_ajax:
            return jsonify({'success':False, 'message': message, 'redirect_url': url_for('login')}), 401
        else:
            flash(message)
            return redirect(url_for('login'))

    try:
        file = request.files.get('scan_image')
        if not file or file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected.'}), 400
        
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        unique_filename = timestamp + filename
        user_path_full = os.path.join(app.config['UPLOAD_FOLDER'], str(session['user_id']))
        os.makedirs(user_path_full, exist_ok=True)
        file_path_full = os.path.join(user_path_full, unique_filename)
        file.save(file_path_full)

        scan_info = {
            'user_id': session['user_id'],
            'scan_date': datetime.strptime(request.form.get('scan_date'), '%Y-%m-%d'),
            'scan_type': request.form.get('scan_type'),
            'facility': request.form.get('facility'),
            'symptoms_notes': request.form.get('symptoms_notes'),
            'image_path': file_path_full 
        }

        analyze_scan = ollama_processor.analyze_scan_results(scan_info)
        scan_id = analyze_scan.get('scan_id')
        scan = Scan.query.get(scan_id)
        if not scan:
            return jsonify({'success': False, 'message': f'Scan with ID {scan_id} not found after processing.'}), 404
        original_image = scan.image_path
        original_image_base64, original_mime_type = file_to_base64(original_image, target_format='PNG') if original_image else None
        processed_image_base64 = None
        processed_dir_path = scan.processed_image_path
        if processed_dir_path and os.path.isdir(processed_dir_path):
            files_in_dir = os.listdir(processed_dir_path)
            if files_in_dir:
                first_file_name = files_in_dir[0]
                processed_image_full_path = os.path.join(processed_dir_path, first_file_name)
                processed_image_base64, processed_mime_type = file_to_base64(processed_image_full_path)
                
            
        return jsonify({
            'success': True,
            'scan_id': scan.id,
            'scan_date': scan.scan_date.strftime('%Y-%m-%d'),
            'scan_type': scan.scan_type,
            'image_base64': original_image_base64,
            'image_mime_type': original_mime_type,
            'yolo_diagnosis': scan.yolo_diagnosis,
            'ai_diagnosis': scan.ai_diagnosis,
            'processed_image_base64': processed_image_base64,
            'processed_image_mime_type': processed_mime_type
        })
            
    except Exception as e:
        print(f"An error occurred in /scan: {e}")
        db.session.rollback()
        message = 'An internal error occurred. Please try again later.'
        if is_ajax:
            return jsonify({'success': False, 'message': message}), 500
        else:
            flash(message)
            return redirect(url_for('app_page', _anchor='scans'))
        
@app.route('/chat', methods=['POST'])
def app_chat():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if 'user_id' not in session:
        message = "Not logged in."
        if is_ajax:
            return jsonify({'success':False, 'message': message, 'redirect_url': url_for('login')}), 401
        else:
            flash(message)
            return redirect(url_for('login'))
    try:
        user_message = request.json['message']
        scan_id = request.json.get('scan_id')
        
        # Get context from recent scan if provided
        if scan_id:
            scan = Scan.query.get(scan_id)
            chat_history = ChatHistory.query.filter_by(scan_id=scan_id).order_by(timestamp).limit(20)
        # Generate AI response
            chat_id = ollama_processor.chat_response(user_message, 'user', session['user_id'], scan_id, chat_history)
            timestamp = ChatHistory.query.get(chat_id).timestamp
            ai_response = ChatHistory.query.get(chat_id).ai_response
        else:
            timestamp = datetime.utcnow
            ai_response = ollama_processor.chat_response(user_message, 'user')
        
        return jsonify({
            'success':True,
            'chat_id': chat_id if chat_id else None,
            'response': ai_response,
            'timestamp': timestamp
        })
    
    except Exception as e:
        message = 'error: ' + str(e)
        if is_ajax:
            return jsonify({'success':False, 'message': message}), 500
        else:
            flash(message)
            return redirect(url_for('app_page', _anchor='chat'))

@app.route('/update_profile', methods=['POST'])
def update_profile():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if 'user_id' not in session:
        message = "Not logged in."
        if is_ajax:
            return jsonify({'success':False, 'message': message, 'redirect_url': url_for('login')}), 401
        else:
            flash(message)
            return redirect(url_for('login'))
    
    try:
        user = User.query.get(session['user_id'])
            
        if 'password' in request.form:
            if check_password_hash(user.password_hash, request.form.get('password')):
                user.password_hash = generate_password_hash(request.form.get('new_password'))
                message = 'Password updated successfully'
            else:
                message = 'Incorrect old password.'
                if is_ajax:
                    return jsonify({'success':False, 'message': message}), 401
                else:
                    flash(message)
                    return redirect(url_for('app'))
                
        elif 'profile_image' in request.files:
            #update profile photo here:
            file = request.files['profile_image']

            if file and file.filename != '':
                filename = secure_filename(file.filename)
                unique_filename = 'user_profile_' + datetime.now().strftime('%Y%m%d%H%M%S_') + filename
                user_path_full = os.path.join(app.config['UPLOAD_FOLDER'], str(session['user_id']))
                os.makedirs(user_path_full, exist_ok=True)
                file_path_full = os.path.join(user_path_full, unique_filename)
                file.save(file_path_full)
                user.profile_photo = file_path_full
                message = 'Profile photo updated successfully'
            else:
                return jsonify({'success': False, 'message': 'No file selected.'}), 400
        else:
            # Update user information
            user.first_name = request.form.get('first_name', user.first_name)
            user.last_name = request.form.get('last_name', user.last_name)
            user.date_of_birth = datetime.strptime(request.form['date_of_birth'], '%Y-%m-%d').date() if request.form.get('date_of_birth') else user.date_of_birth
            user.gender = request.form.get('gender', user.gender)
            user.blood_type = request.form.get('blood_type', user.blood_type)
            user.height = float(request.form['height']) if request.form.get('height') else user.height
            user.weight = float(request.form['weight']) if request.form.get('weight') else user.weight
            user.email = request.form.get('email', user.email)
            user.phone_number = request.form.get('phone_number', user.phone_number)
            user.address = request.form.get('address', user.address)
            user.city = request.form.get('city', user.city)
            user.state_province = request.form.get('state_province', user.state_province)
            user.postal_code = request.form.get('postal_code', user.postal_code)
            user.country = request.form.get('country', user.country)
            user.emergency_contact_name = request.form.get('emergency_contact_name', user.emergency_contact_name)
            user.emergency_contact_relationship = request.form.get('emergency_contact_relationship', user.emergency_contact_relationship)
            user.emergency_contact_phone = request.form.get('emergency_contact_phone', user.emergency_contact_phone)
            user.emergency_contact_email = request.form.get('emergency_contact_email', user.emergency_contact_email)
            user.allergies = request.form.get('allergies', user.allergies)
            user.current_medications = request.form.get('current_medications', user.current_medications)
            user.medical_conditions = request.form.get('medical_conditions', user.medical_conditions)
            message = 'Profile updated successfully'

        db.session.add(user)
        db.session.commit()
        
        return jsonify({'success': True, 'message': message, 'user': user_to_json(user)})
        
    except Exception as e:
        message = 'error: ' + str(e)
        db.session.rollback()
        if is_ajax:
            return jsonify({'success':False, 'message': message}), 500
        else:
            flash(message)
            return redirect(url_for('app_page', _anchor='profile'))

@app.route('/get-user-info', methods=['GET'])
def get_user_info():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    if 'user_id' not in session:
        message = "Not logged in."
        if is_ajax:
            return jsonify({'success': False, 'message': message, 'redirect_url': url_for('login')}), 401
        else:
            flash(message)
            return redirect(url_for('login'))

    user_id = session['user_id']
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'success': False, 'message': f'User with ID {user_id} not found.'}), 404

        return jsonify({
            'success': True,
            'message': 'User info retrieved successfully.',
            'user_info': user_to_json(user)
        })

    except Exception as e:
        message = 'Error: ' + str(e)
        if is_ajax:
            return jsonify({'success': False, 'message': message}), 500
        else:
            flash(message)
            return redirect(url_for('app'))

@app.route('/get-scan-history', methods=['GET'])
def get_scan_history():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    if 'user_id' not in session:
        message = "Not logged in."
        if is_ajax:
            return jsonify({'success': False, 'message': message, 'redirect_url': url_for('login')}), 401
        else:
            flash(message)
            return redirect(url_for('login'))
    try:
        recent_scans = Scan.query.filter_by(user_id=session['user_id']).order_by(Scan.created_at.desc()).limit(5).all()
        return jsonify({
            'success': True,
            'message': 'User scans retrieved successfully.',
            'user_scan': scan_to_json(recent_scans)
        })

    except Exception as e:
        message = 'Error: ' + str(e)
        if is_ajax:
            return jsonify({'success': False, 'message': message}), 500
        else:
            flash(message)
            return redirect(url_for('app'))

@app.route('/get-chat-history', methods=['GET'])
def get_chat_history():
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    if 'user_id' not in session:
        message = "Not logged in."
        if is_ajax:
            return jsonify({'success': False, 'message': message, 'redirect_url': url_for('login')}), 401
        else:
            flash(message)
            return redirect(url_for('login'))

    try:
        chat_history = ChatHistory.query.filter_by(user_id=session['user_id']).order_by(ChatHistory.timestamp).limit(50).all()
        return jsonify({
            'success': True,
            'message': 'User chats retrieved successfully.',
            'user_chat': chathistory_to_json(chat_history)
        })

    except Exception as e:
        message = 'Error: ' + str(e)
        if is_ajax:
            return jsonify({'success': False, 'message': message}), 500
        else:
            flash(message)
            return redirect(url_for('app'))

# @app.route('/get-medical-records', methods=['GET'])
# def get_medical_records():
#     is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

#     if 'user_id' not in session:
#         message = "Not logged in."
#         if is_ajax:
#             return jsonify({'success': False, 'message': message, 'redirect_url': url_for('login')}), 401
#         else:
#             flash(message)
#             return redirect(url_for('login'))

#     try:
#         user = User.query.get(session['user_id'])
#         if not user:
#             return jsonify({'success': False, 'message': "User not found."}), 404

#         all_scans = Scan.query.filter_by(user_id=session['user_id']).order_by(Scan.scan_date.asc()).all()
        
#         if not all_scans:
#             return jsonify({
#                 'success': True,
#                 'user': user_to_json(user),
#                 'scans': [],
#                 'chart_data': {},
#                 'medical_summary': "No medical records found.",
#                 'treatment_draft': "No scan data available to generate a draft.",
#                 'patient_report': "No scan data available to generate a report."
#             })

#         chart_data = {
#             'labels': [scan.scan_date.strftime('%Y-%m-%d') for scan in all_scans],
#             'data': [scan_to_json(all_scans)['tumor_size']]
#         }

#         scan_history_summary = ollama_processor.generate_history_summary(all_scans)
#         latest_scan_report = all_scans[-1].ai_diagnosis

#         prompt1 = f"""
#         As a medical AI assistant, generate a comprehensive, easy-to-understand health report for a patient based on their latest MRI scan analysis and medical history.
#         The report should be encouraging and supportive. Do not provide a diagnosis, but explain the findings clearly.
        
#         Patient's Medical History:
#         - Conditions: {user.medical_conditions or 'Not specified'}
#         - Allergies: {user.allergies or 'Not specified'}
#         - Current Medications: {user.current_medications or 'Not specified'}
        
#         Latest MRI Scan Report (AI Analysis):
#         {latest_scan_report}
        
#         Based on this, generate a report with these sections:
#         1.  **Understanding Your Recent Scan:** A simple explanation of the AI's findings.
#         2.  **General Health & Lifestyle Recommendations:** Suggest general wellness tips (e.g., balanced diet, hydration, stress management) that are beneficial for neurological health.
#         3.  **Important Reminders:** Advise the patient to always consult their doctor for diagnosis and treatment, and to follow their doctor's advice.
#         """

#         prompt2 = f"""
#         As an AI assistant for a neurologist, create a clinical draft based on a patient's full scan history and latest MRI results.
#         This draft is for the doctor to review, edit, and finalize.
        
#         Patient's Scan History Summary:
#         {scan_history_summary}
        
#         Latest MRI Scan Report (AI Analysis):
#         {latest_scan_report}
        
#         Based on this, draft a note with the following structure:
#         1.  **Clinical Assessment:** Briefly summarize the findings and compare them with previous scans (e.g., "The mass in the right frontal lobe appears stable in size compared to the scan from 3 months ago.").
#         2.  **Treatment Suggestions for Consideration:** Propose potential next steps based on common clinical guidelines (e.g., "Continue watchful waiting with a follow-up MRI in 6 months," or "Consider referral for surgical consultation given the slight increase in size.").
#         3.  **Medication Considerations:** Mention any relevant medications or contraindications based on the patient's profile (e.g., "Patient is currently on [medication], which should be considered in any treatment plan.").
#         """

#         prompt3 = f"""
#         Based on the following patient details, generate a concise one-paragraph medical summary.
#         - Conditions: {user.medical_conditions or 'Not specified'}
#         - Allergies: {user.allergies or 'Not specified'}
#         - Current Medications: {user.current_medications or 'Not specified'}
#         - Summary of symptoms from all scans: {'. '.join([s.symptoms_notes for s in all_scans if s.symptoms_notes])}
#         """

#         patient_report = ollama_processor.generate_response(prompt=prompt1, images=[all_scans[-1].image_path])
#         treatment_draft = ollama_processor.generate_response(prompt=prompt2, images=[all_scans[-1].image_path])
#         medical_summary = ollama_processor.generate_response(prompt=prompt3)

#         return jsonify({
#             'success': True,
#             'user': user_to_json(user),
#             'scans': scan_to_json(all_scans),
#             'chart_data': chart_data,
#             'medical_summary': medical_summary,
#             'treatment_draft': treatment_draft,
#             'patient_report': patient_report
#         })

#     except Exception as e:
#         message = 'Error: ' + str(e)
#         if is_ajax:
#             return jsonify({'success': False, 'message': message}), 500
#         else:
#             flash(message)
#             return redirect(url_for('app_page'))  

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)