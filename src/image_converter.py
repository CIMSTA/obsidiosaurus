import os
from pathlib import Path
from PIL import Image
from loguru import logger
from src.utils import convert_whitespaces
IMAGE_DETAILS = []
SVG_DETAILS = []

def convert_and_resize_image(image, src_path, config):
    DST_DIR = Path(config['docusaurus_directory'])
    DST_ASSET_SUBFOLDER = config['docusaurus_asset_subfolder_name']
    CONVERT_IMAGE_TYPE = config['converted_image_type']
    CONVERT_IMAGE_MAX_WIDTH = int(config['converted_image_max_width'])

    logger.debug(f"🔄 Converting and resizing image: {image}")

    filepath = Path(src_path) / image
    img = Image.open(filepath)

    logger.debug(f"Image Details: {IMAGE_DETAILS}")
    for image_detail in IMAGE_DETAILS:
        if image_detail["filename"] == image:
            width = image_detail.get("width")
            height = image_detail.get("height")

            if width is not None:
                width = int(width)
            elif img.width > CONVERT_IMAGE_MAX_WIDTH:
                width = CONVERT_IMAGE_MAX_WIDTH

            if height is not None:
                height = int(height)

            if width is not None and height is None:
                height = int(width * img.height / img.width)
            elif width is None and height is None:
                height = img.height
                width = img.width

            logger.debug(f"🔍 New dimensions for image {image}: width={width}, height={height}")

            img = img.resize((width, height), Image.LANCZOS)

            dst_dir_path = DST_DIR / "static" / DST_ASSET_SUBFOLDER 
            dst_dir_path.mkdir(parents=True, exist_ok=True)

            file_name = image_detail["filename_new"].replace(" ", "_") + "." + CONVERT_IMAGE_TYPE
            dst_file_path = dst_dir_path / file_name 

            logger.debug(f"📁 Saving converted image to: {dst_file_path}")

            img.save(dst_file_path, CONVERT_IMAGE_TYPE)

    logger.info(f"✅ Completed converting and resizing image: {image}")




def convert_svg_colors(input_file, src_path, config):
    DST_DIR = Path(config['docusaurus_directory'])
    DST_ASSET_SUBFOLDER = config['docusaurus_asset_subfolder_name']
    light_color = "#c9d1d9"
    dark_color = "#0d1117"

    # Define output file names
    base_name = convert_whitespaces(os.path.splitext(input_file)[0])
    
    light_output_file = f"{base_name}.light.svg"
    dark_output_file = f"{base_name}.dark.svg"

    # Paths for the output files
    dst_dir_path = DST_DIR / "static" / DST_ASSET_SUBFOLDER
    dst_dir_path.mkdir(parents=True, exist_ok=True)
    light_output_path = dst_dir_path / light_output_file
    dark_output_path = dst_dir_path / dark_output_file

    with open(Path(src_path) / input_file, 'r') as file:
        data = file.read()

    # Save a copy of the original file as <name>.light.svg
    with open(light_output_path, 'w') as file:
        file.write(data)

    # Convert colors and save as <name>.dark.svg
    data = data.replace('rgb(0, 0, 0)', light_color)
    data = data.replace('rgb(255, 255, 255)', dark_color)

    with open(dark_output_path, 'w') as file:
        file.write(data)

    logger.info(f"✅ Completed converting colors for SVG: {input_file}")
