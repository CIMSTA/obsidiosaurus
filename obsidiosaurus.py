"""
Convert markdown files from obsidian to docusaurus
"""

import re
import os
import shutil
import configparser
from datetime import datetime
from pathlib import Path

# Read
config = configparser.ConfigParser()
config.read("obsidiosaurus-config.ini")

# Load config file
# Directories
SRC_DIR = config.get("Directories", "obsidian_vault_directory")
DST_DIR = config.get("Directories", "docusaurus_directory")
IGNORED_DIRS = config.get("Directories", "ignored_folders").split(",")

# Assets
ASSET_FOLDER_NAME = config.get("Assets", "obsidian_asset_folder_name")
DST_ASSET_SUBFOLDER = config.get("Assets", "docusaurus_asset_subfolder_name")

# Language variables
I18N_SUPPORTED = config.getboolean("Language", "i18n_supported")
LANGUAGE_SEPERATOR = config.get("Language", "language_separator")
MAIN_LANGUAGE = config.get("Language", "main_language")
SECONDARY_LANGUAGES = config.get("Language", "secondary_languages").split(",")

# Images
CONVERT_IMAGES = config.getboolean("Images", "convert_images")
CONVERT_IMAGE_TYPE = config.get("Images", "converted_image_type")
CONVERT_IMAGE_MAX_WIDTH = config.get("Images", "converted_image_max_width")

# Features
SUPPORTED_ADMONITION_TYPES = ["note", "tip", "info", "caution", "danger"]
EXCALIDRAW = config.getboolean("Features", "excalidraw")
DIAGRAM_NET = config.getboolean("Features", "diagrams_net")

# Global variables
IMAGE_DETAILS = []
CONTENT_TYPE = ""
CONTENT_NAME = ""
LOG_FILE = DST_DIR + "/obsidiosaurus.log"
SIDEBAR = ""
ADMONITION_WHITESPACES = 0


def main():
    prepare_dst_dir()
    process_src_dir()


# If Log File is found delete all files created by Obsidiosaurus
def prepare_dst_dir():
    global DST_DIR
    if not os.path.exists(LOG_FILE):
        return
    with open(LOG_FILE, "r") as f:
        for line in f:
            _, file, rel_path_temp = line.strip().split(",")
            file_path = DST_DIR + rel_path_temp
            os.remove(file_path)
            parent_dir = os.path.dirname(file_path)
            try:
                os.rmdir(parent_dir)
            except OSError:
                pass
    os.remove(LOG_FILE)


def build_rel_dst_path(splitted_path, language, secondary_language):
    # Copy File to output path
    global DST_DIR, CONTENT_TYPE, CONTENT_NAME
    rel_file_path = "/".join(splitted_path)

    if CONTENT_TYPE == "docs_base":
        # Base Docs:
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + rel_file_path
        else:
            # root / i18n / [locale] / docusaurus - plugin - content - docs
            rel_path = (
                "/i18n/{}/docus"
                "aurus-plugin-content-docs/".format(language) + rel_file_path
            )

    elif CONTENT_TYPE == "blog_base":
        # Base Blog:
        # root/i18n/[locale]/docusaurus-plugin-content-blog
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + rel_file_path
        else:
            rel_path = (
                "/i18n/{}/docusaurus-plugin-content-blog/".format(language)
                + rel_file_path
            )
    elif CONTENT_TYPE == "blog_multi":
        # Multi Instance:
        # root / i18n / [locale] / docusaurus - plugin - content - blog - [pluginId]
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + rel_file_path
        else:
            rel_path = (
                "/i18n/{}/docusaurus-plugin-content-blog/{}/".format(
                    language, CONTENT_NAME
                )
                + rel_file_path
            )
    return rel_path


def write_log_file(file_name, final_rel_path):
    with open(LOG_FILE, "a") as file:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        file.write(f"{now},{file_name},{final_rel_path}\n")


def process_src_dir():
    global CONTENT_TYPE, CONTENT_NAME, ASSET_FOLDER_NAME
    folder_list = os.listdir(SRC_DIR)
    folder_list[:] = [d for d in folder_list if d not in IGNORED_DIRS]

    for folder in folder_list:
        CONTENT_TYPE = ""
        CONTENT_NAME = ""
        search_folder = os.path.join(SRC_DIR, folder)
        if folder == "docs":
            CONTENT_TYPE = "docs_base"
            CONTENT_NAME = "docs"
            process_markdown(search_folder)
        elif folder == "blog":
            CONTENT_TYPE = "blog_base"
            CONTENT_NAME = "blog"
            process_markdown(search_folder)
        elif folder.endswith("__blog"):
            CONTENT_TYPE = "blog_multi"
            CONTENT_NAME = folder.rstrip("__blog")
            process_markdown(search_folder)
        elif folder == ASSET_FOLDER_NAME:
            CONTENT_TYPE = "asset"
            CONTENT_NAME = "assets"
            process_assets(search_folder)


def process_markdown(search_folder):
    global I18N_SUPPORTED, SIDEBAR
    for root, sub_dir, files in os.walk(search_folder):
        for file in files:
            if file.endswith(".md") and not file.endswith("excalidraw.md"):
                # create absolute source file path
                abs_src_file_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_src_file_path, SRC_DIR)
                # convert backward slashes to forward
                rel_path = str(Path(rel_path).as_posix())
                # remove the first folder docs, blog, ...
                splitted_path = rel_path.split("/")[1:]
                if CONTENT_TYPE == "docs_base":
                    sidebar = splitted_path[0]
                path_depth = len(splitted_path)

                full_file_name = splitted_path[path_depth - 1]
                file_name = full_file_name.split(".")[0]
                language = ""
                secondary_language = False

                if I18N_SUPPORTED and path_depth > 1:
                    grouped = check_i18n_grouping(
                        splitted_path[path_depth - 2], file_name
                    )
                    if grouped:
                        # Replaces file name with last dir name
                        splitted_path.pop(-1)
                        path_depth = path_depth - 1
                        splitted_path[-1] += ".md"
                language, secondary_language = check_language(file_name)
                new_file_name = splitted_path[-1]
                # Build the final dest path where the file should be copied to
                rel_dst_file_path = build_rel_dst_path(
                    splitted_path, language, secondary_language
                )
                abs_dst_file_path = DST_DIR + rel_dst_file_path
                # Checks if the folder where to copy is already created
                dst_dir = os.path.dirname(abs_dst_file_path)
                os.makedirs(dst_dir, exist_ok=True)
            # TODO add convert urls, images, ..

            convert_file(abs_src_file_path, abs_dst_file_path)
            write_log_file(new_file_name, rel_dst_file_path)
    pass


def process_assets(search_folder):
    # ignore
    pass


def remove_number_prefix(string):
    # Removes all common numbering styles: 1), 1., 1 -, ...
    return re.sub(r"^\d+[\.\-\)\s]*\s*", "", string).strip()


def removes_whitespaces(string):
    re.sub(" ", "", string)


def replace_whitespaces(string):
    re.sub(" ", "_", string)


def check_i18n_grouping(last_dir, file_name):
    # Check if file name and last directory name match
    # X/sidebar1/note/note__en.md -> X/sidebar1/note.md
    file_name = remove_number_prefix(file_name)
    last_dir = remove_number_prefix(last_dir)
    if file_name.split("__")[0].lower() == last_dir.lower():
        return True
    return False


def check_language(name):
    global SECONDARY_LANGUAGES
    name_split = name.split("__")
    if len(name_split) > 1:
        new_name = name_split[0]
        language = name_split[1]
        # Returns e.g. "fr" and "True" if French is defined as secondary language
        return language, language in SECONDARY_LANGUAGES
    return MAIN_LANGUAGE, False


def convert_file(input_file, output_file):
    # Open the input file and read it line by line
    with open(input_file, "r") as file:
        lines = file.readlines()

    # Open the output file
    with open(output_file, "w") as file:
        in_admonition, in_quote = False, False
        sidebar_checked = False

        for line in lines:
            if CONTENT_TYPE == "docs_base" and not sidebar_checked:
                line, sidebar_checked = write_sidebar_frontmatter(line)
            line, in_admonition, in_quote = process_admonition(
                line, in_admonition, in_quote
            )
            # line = process_urls(line)
            # line = process_assets(line)
            # line = process_excalidraw(line)
            # line = process_diagrams(line)
            file.write(line)


def write_sidebar_frontmatter(line):
    global SIDEBAR
    if line == "---\n":
        line = "---\ndisplayed_sidebar: " + SIDEBAR + "\n"
    else:
        old_line = line
        line = "---\ndisplayed_sidebar: " + SIDEBAR + "\n---\n" + old_line
    sidebar_checked = True
    return line, sidebar_checked


def process_admonition(line, in_admonition, in_quote):
    global ADMONITION_WHITESPACES
    processed_line = ""
    if in_admonition:
        # If we're in an admonition, check for the end of the block
        if line == "\n":
            in_admonition = False
            processed_line = ":::\n\n"
        else:
            processed_line = line[ADMONITION_WHITESPACES:]
    elif in_quote:
        if "-" in line:
            processed_line = line.replace("-", "—")
            processed_line = "> \n" + processed_line
            in_quote = False
        else:
            processed_line = line
    else:
        # If we're not in an admonition, check for the start of a new one
        # Checks if line start with ">"
        type, title, whitespaces = "", "", 0
        match_1 = re.match(r"^>", line)
        if match_1:
            # Checks if its followed by "[!...]"
            match_2 = re.search(r"\[!(.*)\]", line)
            if match_2:
                type = match_2.group(1)
                # Checks if there is a title "[!...] Title"
                match_3 = re.search(r"\[!(.*)] (.*)", line)
                if match_3:
                    title = match_3.group(2)
            # Count how many whitespaces are between ">" and "["
            ADMONITION_WHITESPACES = line.find("[") - line.find(">")

        if type:
            print(type)
            if type == "quote":
                processed_line = ""
                in_quote = True
            elif type not in SUPPORTED_ADMONITION_TYPES:
                processed_line = line
            else:
                in_admonition = True
                if not title:
                    processed_line = ":::" + type + "\n"
                else:
                    processed_line = ":::" + type + " " + title + "\n"
        else:
            processed_line = line

    return processed_line, in_admonition, in_quote


# def process_quote(line):


# def process_urls(line):
# if i18n_supported:
#    for code in secondary_languages_codes:
#       if code in line:
#            line = re.sub("code", "", line)
# if "![](assets/" in line:
#    line = re.sub("%20", "_", line)
# return re.sub(r"\[(.*?)]\((\.\./)+(.*?)\.md\)", "[\\1](./\\3)", line)


main()
