import sys
import json
import platform
from loguru import logger
from pathlib import Path
from src.directory_cleanup import directory_cleanup
from src.dir_processing import process_src_dir


def main(vault_directory, root_directory):
     
    config = read_config_json(vault_directory, root_directory)
    config_message = "\n".join([f"{key}: {value}" for key, value in config.items()])
    logger.debug(f"⚙ Using the following configuration:\n{config_message}")
    
    directory_cleanup(config)
    logger.info("✅ Finished directory cleanup")
    
    process_src_dir(config)
       
    
def read_config_json(vault_directory, root_directory):
    config_file_directory = vault_directory / ".obsidian" / "plugins" / "obsidiosaurus" / "data.json"
    
    if not config_file_directory.exists():
        error_message = f"❌ Configuration file not found: {config_file_directory}"
        logger.error(error_message)
        raise FileNotFoundError(error_message)

    # Open the JSON configuration file and load it into a dictionary
    with open(config_file_directory, 'r') as config_file:
        config = json.load(config_file)

    # Append variables to the config dictionary
    docusaurus_directory = root_directory / "docusaurus"
    config['root_directory'] = str(root_directory)
    config['vault_directory'] = str(vault_directory)
    config['docusaurus_directory'] = str(docusaurus_directory)
    config['config_file_directory'] = str(config_file_directory)
    config['log_file_name'] = "obsidiosaurus.log"
    config['log_file_path'] =  str(root_directory / config['log_file_name'])
    config['operating_system'] =  str(platform.system())
    config['admonition_whitespaces'] = 0
    config['supported_admonitation_types'] = ["note", "tip", "info", "caution", "danger"]
    
    
    
    logger.info("✅ Successfully found and read the configuration file")
    
    return config
    
        
if __name__ == "__main__":
    vault_directory = Path(sys.argv[1])
    root_directory = vault_directory.parent
    
    logger_path = root_directory / "info.log"
    logger.add(logger_path, level="DEBUG")
    logger.info("🚀 Starting Obsidiosaurus Conversion")
    
    main(vault_directory, root_directory)