from ultralytics import YOLO
import cv2
import numpy as np

# مسیر وزن های بهترین مدل آموزش دیده شما
# این مسیر رو بر اساس نامی که در مرحله آموزش دادید، تنظیم کنید.
TRAINED_MODEL_PATH = 'app/best.pt'

# مسیر تصویر یا پوشه ای از تصاویر برای پیش بینی
# این میتونه یک فایل .tif باشه یا یک پوشه حاوی تصاویر تستی.
# **مهم:** از تصاویری استفاده کنید که در دیتاست آموزش و اعتبارسنجی شما نبودند!
INPUT_SOURCE = 'app/input/test/' # مثلاً 'test_images/TCGA_CS_4941_19960909_20.tif'
# یا INPUT_SOURCE = 'path/to/your/test_images_folder/'

# 1. بارگذاری مدل آموزش دیده
model = YOLO(TRAINED_MODEL_PATH)

# 2. پیش بینی روی تصاویر
# show=True: نتایج رو در یک پنجره نمایش میده (اگر در محیط گرافیکی باشید).
# save=True: نتایج رو در پوشه خروجی ذخیره میکنه.
# conf: حداقل امتیاز اطمینان برای نمایش پیش بینی ها (بین 0 تا 1).
# iou: آستانه IOU برای NMS (Non-Maximum Suppression).

results = model.predict(
    source=INPUT_SOURCE,
    show=True,
    save=True,
    conf=0.5, # فقط پیش بینی های با اطمینان بالای 50% رو نشون بده
    iou=0.7 # آستانه IOU برای NMS
)

# 3. دسترسی به نتایج و نمایش سفارشی (اختیاری)
# نتایج پیش بینی شده در لیستی از آبجکت های 'Results' برگردانده میشن.
# هر آبجکت 'Results' مربوط به یک تصویر ورودی هست.
for result in results:
    # result.orig_img: تصویر اصلی (به فرمت NumPy Array)
    # result.boxes: باکس های تشخیص داده شده (اگر همزمان تشخیص شی هم انجام بشه)
    # result.masks: ماسک های سگمنتیشن (اگر سگمنتیشن باشه)
    # result.probs: احتمالات کلاس (برای طبقه بندی)

    if result.masks is not None:
        # ماسک ها به صورت آبجکت MaskData هستند
        # می تونید اون ها رو به NumPy array تبدیل کنید تا روی تصویر اصلی ترسیم کنید.
        masks = result.masks.data # (N, H, W) N: تعداد آبجکت های تشخیص داده شده
        with np.printoptions(threshold=np.inf):
            print(masks)
        # تبدیل ماسک ها به یک تصویر باینری کلی (اختیاری)
        # این کد همه ماسک ها رو روی هم میندازه تا یک ماسک نهایی از تومور رو ایجاد کنه.
        combined_mask = np.zeros(result.orig_img.shape[:2], dtype=np.uint8)
        for i, mask_tensor in enumerate(masks):
            # تبدیل تنسور ماسک به NumPy array و تغییر اندازه به سایز تصویر اصلی
            mask_np = mask_tensor.cpu().numpy().astype(np.uint8) * 255
            # اعمال ماسک به تصویر اصلی یا یک کپی از اون
            # برای سگمنتیشن روی تصاویر پزشکی، اغلب می خوایم فقط ناحیه ماسک رو برجسته کنیم.
            # می تونید این قسمت رو برای نیازهای نمایش خودتون تغییر بدید.

            # برای ترسیم کانتور روی تصویر
            # پیدا کردن کانتور از ماسک
            contours, _ = cv2.findContours(mask_np, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # ترسیم کانتور روی یک کپی از تصویر اصلی
            display_img = result.orig_img.copy()
            
            # تبدیل تصویر اصلی (که ممکن است grayscale باشد) به RGB برای نمایش رنگی
            if len(display_img.shape) == 2: # اگر grayscale هست
                display_img = cv2.cvtColor(display_img, cv2.COLOR_GRAY2BGR)

            # ترسیم کانتور با رنگ سبز (B, G, R) و ضخامت 2
            cv2.drawContours(display_img, contours, -1, (0, 255, 0), 2)
            
            # اضافه کردن یک شفافیت به ناحیه ماسک شده (اختیاری)
            overlay = np.zeros_like(display_img)
            color = (0, 255, 0) # سبز
            alpha = 0.3 # شفافیت
            cv2.drawContours(overlay, contours, -1, color, -1) # پر کردن کانتور
            display_img = cv2.addWeighted(display_img, 1 - alpha, overlay, alpha, 0)

            # نمایش تصویر با کانتور
            cv2.imshow(f"Prediction for {result.path.split('/')[-1]} - Mask {i+1}", display_img)
            cv2.waitKey(0)
            cv2.destroyAllWindows()
            
            # همچنین می تونید ماسک رو جداگانه ذخیره کنید (اختیاری)
            cv2.imwrite(f"output_masks/{result.path.split('/')[-1]}_mask_{i+1}.png", mask_np)

print("پیش بینی ها انجام شد و نتایج ذخیره شده اند.")
