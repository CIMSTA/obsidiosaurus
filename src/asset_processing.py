import re
import os 
import shutil
from pathlib import Path
from src.image_converter import convert_and_resize_image, convert_svg_colors
from src.utils import convert_whitespaces
from loguru import logger

def process_assets(search_folder, config):
    global DST_DIR
    global DST_ASSET_SUBFOLDER

    DST_DIR = Path(config['docusaurus_directory'])
    DST_ASSET_SUBFOLDER = config['docusaurus_asset_subfolder_name']

    dst_dir_path = DST_DIR / "static" / DST_ASSET_SUBFOLDER 
    dst_dir_path.mkdir(parents=True, exist_ok=True)

    svg_pattern = re.compile(r"\.excalidraw\.(dark|light)\.svg$", re.IGNORECASE)

    for file in os.listdir(search_folder):
        file_path = Path(search_folder) / file
        if file.endswith((".jpg", ".png")):
            convert_and_resize_image(file, search_folder, config)
        elif file.endswith(".svg") and not svg_pattern.search(file):
            convert_svg_colors(file, search_folder, config)
        elif not file.endswith(".excalidraw.md"):
            file_name = convert_whitespaces(file)
            dst_file_path = dst_dir_path / file_name
            shutil.copy(file_path, dst_file_path)
    logger.info(f"✅ Completed Converion")