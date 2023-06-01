import os
from pathlib import Path
from loguru import logger

"""
Prepare the destination directory (DST_DIR) by removing files and directories
previously logged in the LOG_FILE. It first removes the files listed in the log file, then
removes the directories (deepest first) containing those files, and finally deletes the log file.

Note:
    This function assumes that the LOG_FILE is properly formatted with comma-separated values, where
    each line contains a file or directory to be removed.
"""

def directory_cleanup(config):
    
    logger.info(f"🧹 Starting Docusaurus Directory Cleanup")
    
    DST_DIR = Path(config['docusaurus_directory'])
    LOG_FILE = Path(config['log_file_path'])
    
    if not LOG_FILE.exists():
        logger.info(f"📄 Log file {LOG_FILE} not found, skipping directory cleanup.")
        return

    files_to_remove, dirs_to_remove = read_log_file(LOG_FILE, DST_DIR)
    remove_files(files_to_remove)
    remove_directories(dirs_to_remove, DST_DIR)
    remove_log_file(LOG_FILE)


def read_log_file(LOG_FILE, DST_DIR):
    # Set = Unordered collection with no duplicate elements
    dirs_to_remove = set()
    files_to_remove = []

    # Read the log file and collect files and directories to remove
    with LOG_FILE.open("r", encoding="utf-8") as log_file:
        for line in  log_file:
            _, _, rel_path_temp = line.strip().split(",")
            file_path = DST_DIR / rel_path_temp[1:] 

            # Collect files to remove
            files_to_remove.append(file_path)

            # Collect directories to remove
            parent_dir = file_path.parent
            while parent_dir != DST_DIR:
                dirs_to_remove.add(parent_dir)
                parent_dir = parent_dir.parent
                
    logger.info(f"📚 Collected {len(files_to_remove)} files and {len(dirs_to_remove)} directories from log file.")
    return files_to_remove, dirs_to_remove


def remove_files(files):
    for file_path in files:
        try:
            os.remove(file_path)
            logger.info(f"🗑️  Removing file: {file_path}")
        except OSError as e:
            logger.error(f"❌ Error removing file {file_path}: {e}")


def remove_directories(dirs, base_dir):
    # Sort directories by depth (deepest first)
    sorted_dirs = sorted(dirs, key=lambda x: get_depth(x, base_dir), reverse=True)
    
    for directory in sorted_dirs:
        try:
            os.rmdir(directory)
            logger.info(f"🗑️  Removing directory: {directory}")
        except OSError as e:
            logger.error(f"❌ Error removing directory {directory}: {e}")


def get_depth(directory, base_dir):
    # Calculate the depth of the directory relative to the base directory
    return len(Path(directory).relative_to(base_dir).parts)


def remove_log_file(log_file):
    try:
        os.remove(log_file)
        logger.info(f"🗑️ Removing log file: {log_file}")
    except OSError as e:
        logger.error(f"❌ Error removing log file {log_file}: {e}")





