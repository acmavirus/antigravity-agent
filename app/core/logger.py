import logging
import re
import os
from datetime import datetime

class LogSanitizer(logging.Filter):
    def filter(self, record):
        msg = str(record.msg)
        # Mask emails
        msg = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[EMAIL_MASKED]', msg)
        # Mask tokens (assuming they look like base64 or long hex)
        msg = re.sub(r'eyJ[\w-]*\.eyJ[\w-]*\.[\w-]*', '[TOKEN_MASKED]', msg)
        # Generic sensitive patterns
        msg = re.sub(r'(?i)(password|token|key|secret)["\s:]+[\w-]+', r'\1: [REDACTED]', msg)
        
        record.msg = msg
        return True

def setup_logger():
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_file = os.path.join(log_dir, f"agent_{datetime.now().strftime('%Y%m%d')}.log")
    
    logger = logging.getLogger("antigravity")
    logger.setLevel(logging.INFO)
    
    # Sanitize filter
    sanitizer = LogSanitizer()
    logger.addFilter(sanitizer)
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    # File Handler
    fh = logging.FileHandler(log_file, encoding='utf-8')
    fh.setFormatter(formatter)
    logger.addHandler(fh)
    
    # Console Handler
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    
    return logger

# Single instance
logger = setup_logger()
