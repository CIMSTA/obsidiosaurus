import os
from pathlib import Path
from src.md_processing import process_markdown
from src.asset_processing import process_assets
from loguru import logger

def process_src_dir(config):
    """
    This function processes the source directory `SRC_DIR` and its subdirectories.

    The function retrieves the list of subdirectories in `SRC_DIR` and removes
    the subdirectories that are listed in the global variable `IGNORED_DIRS`.
    Then, the function checks each subdirectory against several conditions to
    determine the content type and name. The content type and name are used
    to call different processing functions.

    The function sets the global variables `CONTENT_TYPE` and `CONTENT_NAME`
    to store the content type and name for each subdirectory.
    """
    CONTENT_TYPE = ""
    CONTENT_NAME = ""
    
    SRC_DIR = config['vault_directory']
    ASSET_FOLDER_NAME = config['obsidian_asset_folder_name']
    IGNORED_DIRS = config['ignored_folders']
    
    logger.info(f"📁 Processing source directory: {SRC_DIR}")
    
    # Makes sure that "asset" folder is always last to process
    folder_list = [
        d
        for d in os.listdir(SRC_DIR)
        if d not in IGNORED_DIRS and d != ASSET_FOLDER_NAME
    ]
    
    folder_list = folder_list + [ASSET_FOLDER_NAME]
    logger.debug(f"📂 Folders to process: {folder_list}")
    
    for folder in folder_list:
        search_folder = os.path.join(SRC_DIR, folder)
        
        if folder == "docs":
            CONTENT_TYPE = "docs_base"
            CONTENT_NAME = "docs"
        elif folder == "blog":
            CONTENT_TYPE = "blog_base"
            CONTENT_NAME = "blog"
        elif folder.endswith("__blog"):
            CONTENT_TYPE = "blog_multi"
            CONTENT_NAME = folder.rstrip("__blog")
        elif folder == ASSET_FOLDER_NAME:
            CONTENT_TYPE = "asset"
            CONTENT_NAME = "assets"
            logger.info(f"🔄 Processing assets in folder: {search_folder}")
            process_assets(search_folder, config)
            continue 
        
        logger.info(f"🔄 Processing markdown in folder: {search_folder}")
        process_markdown(search_folder, CONTENT_TYPE, CONTENT_NAME, config)
        
        
