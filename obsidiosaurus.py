"""
Convert markdown files from obsidian to docusaurus
"""

import re
import os
import configparser
import shutil
from datetime import datetime
from pathlib import Path
from PIL import Image
from PIL.Image import Resampling

# Read Config File
config = configparser.ConfigParser()
config.read("obsidiosaurus-config.ini")

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
CONVERT_IMAGE_MAX_WIDTH = config.getint("Images", "converted_image_max_width")

# Features
SUPPORTED_ADMONITION_TYPES = ["note", "tip", "info", "caution", "danger"]
EXCALIDRAW = config.getboolean("Features", "excalidraw")

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
    """
    This function deletes all files and directories created by Obsidiosaurus,
    if the log file `LOG_FILE` exists.

    The function reads the log file line by line, retrieves the file path,
    and removes the file. Then, it tries to remove the parent directory
    of the file. If the parent directory is not empty, it continues to the next
    line of the log file. If the log file is empty, it removes the log file itself.

    The function uses the global variable `DST_DIR` as the base directory to construct
    the file path.
    """
    global DST_DIR
    if not os.path.exists(LOG_FILE):
        return
    with open(LOG_FILE, "r", encoding="utf-8") as log_file:
        for line in log_file:
            _, _, rel_path_temp = line.strip().split(",")
            file_path = DST_DIR + rel_path_temp
            os.remove(file_path)
            parent_dir = os.path.dirname(file_path)
            try:
                os.rmdir(parent_dir)
            except OSError:
                pass
    os.remove(LOG_FILE)


def build_rel_dst_path(path, language, secondary_language):
    """
    Construct a relative file path for various content types in Docusaurus.

    The content type can be one of the following:
    - Base Docs: `docs_base`
    - Base Blog: `blog_base`
    - Multi Instance Blog: `blog_multi`
    """
    global DST_DIR, CONTENT_TYPE, CONTENT_NAME

    if CONTENT_TYPE == "docs_base":
        # Base Docs:
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + path
        else:
            # root / i18n / [locale] / docusaurus - plugin - content - docs
            rel_path = (
                    "/i18n/{}/docusaurus-plugin-content-docs/current/".format(language) + path
            )

    elif CONTENT_TYPE == "blog_base":
        # Base Blog:
        # root/i18n/[locale]/docusaurus-plugin-content-blog
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + path
        else:
            rel_path = (
                    "/i18n/{}/docusaurus-plugin-content-blog/".format(language)
                    + path
            )
    elif CONTENT_TYPE == "blog_multi":
        # Multi Instance:
        # root / i18n / [locale] / docusaurus - plugin - content - blog - [pluginId]
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + path
        else:
            rel_path = (
                    "/i18n/{}/docusaurus-plugin-content-blog-{}/".format(
                        language, CONTENT_NAME
                    )
                    + path
            )

    elif CONTENT_TYPE == "asset":
        rel_path = "/static/" + DST_ASSET_SUBFOLDER + "/" + path
    else:
        return None
    return rel_path


def write_log_file(file_name, final_rel_path):
    with open(LOG_FILE, "a", encoding="utf-8") as file:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        file.write(f"{now},{file_name},{final_rel_path}\n")


def process_src_dir():
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
    global CONTENT_TYPE, CONTENT_NAME, ASSET_FOLDER_NAME
    # Makes sure that "asset" folder is always last to process
    folder_list = [d for d in os.listdir(SRC_DIR) if d not in IGNORED_DIRS and d != ASSET_FOLDER_NAME]
    for folder in folder_list + [ASSET_FOLDER_NAME]:
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
    for root, _, files in os.walk(search_folder):
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
                    SIDEBAR = splitted_path[0]
                path_depth = len(splitted_path)

                full_file_name = splitted_path[path_depth - 1]
                file_name = full_file_name.split(".")[0]

                if I18N_SUPPORTED and path_depth > 1:
                    grouped = check_i18n_grouping(
                        splitted_path[path_depth - 2], file_name
                    )
                    if grouped:
                        # Replaces file name with last dir name
                        splitted_path.pop(-1)
                        splitted_path[-1] += ".md"
                language, secondary_language = check_language(file_name)
                new_file_name = splitted_path[-1]
                for i, part in enumerate(splitted_path):
                    splitted_path[i] = convert_whitespaces(part)
                # Build the final dest path where the file should be copied to
                path = "/".join(splitted_path)
                rel_dst_file_path = build_rel_dst_path(
                    path, language, secondary_language
                )
                abs_dst_file_path = DST_DIR + rel_dst_file_path
                # Checks if the folder where to copy is already created
                dst_dir = os.path.dirname(abs_dst_file_path)
                os.makedirs(dst_dir, exist_ok=True)
                convert_file(abs_src_file_path, abs_dst_file_path)
                write_log_file(new_file_name, rel_dst_file_path)


def check_i18n_grouping(last_dir, file_name):
    """
    Checks if the file name and the last directory name match for internationalization grouping.
    This function takes two arguments, the last directory name and the file name, and checks if
    they match for grouping in internationalization.
    If the file name and last directory name match, the function returns True.
    X/sidebar1/note/note__en.md -> X/sidebar1/note.md
    """
    file_name = remove_number_prefix(file_name)
    last_dir = remove_number_prefix(last_dir)
    if file_name.split("__")[0].lower() == last_dir.lower():
        return True
    return False


def check_language(name):
    """
    Checks if the file name is in the format <file_name><LANGUAGE_SEPERATOR><language_code>.
    note__en.md, note__de.md
    If yes, returns the language code and a boolean indicating if the language is a secondary language.
    If not, returns the main language and False.
    """
    global SECONDARY_LANGUAGES
    name_split = name.split(LANGUAGE_SEPERATOR)
    if len(name_split) > 1:
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
            line, in_admonition, in_quote = convert_admonition(
                line, in_admonition, in_quote
            )
            # line = convert_urls(line)
            line = convert_assets(line)
            line = convert_links(line)
            line = convert_excalidraw(line)
            line = convert_svg(line)
            file.write(line)


def write_sidebar_frontmatter(line):
    """
    Add 'displayed_sidebar' to the frontmatter of the markdown file.

    This function adds the 'displayed_sidebar' key to the frontmatter of a
    markdown file, and sets its value to the global variable `SIDEBAR`.
    If the frontmatter already exists, it adds the key to the existing frontmatter.
    """
    global SIDEBAR
    if line == "---\n":
        line = "---\ndisplayed_sidebar: " + SIDEBAR + "\n"
    else:
        old_line = line
        line = "---\ndisplayed_sidebar: " + SIDEBAR + "\n---\n" + old_line
    sidebar_checked = True
    return line, sidebar_checked


def convert_admonition(line, in_admonition, in_quote):
    """
    This function processes a line in a markdown file, and returns the processed line,
    and the updated values of the flags in_admonition and in_quote.

    The function first checks if we are currently inside an admonition (a special type of
     markdown block, such as a note or warning). If we are, it checks if the line marks the
     end of the block, and returns the processed line accordingly. If not, it returns the
     line with the appropriate whitespaces removed.

    If we are not in an admonition, the function checks if we are in a quote, and if the line
    ends the quote.
    If we are in a quote, the line is returned with ">" added to the start, and "-" replaced with "—".

    If we are not in a quote or an admonition, the function checks if the line starts a new one.
    If it does, it checks the type of the admonition (note, warning, etc.), and if it is supported.
    If the type is supported, the function sets the in_admonition flag to True, and returns the
    line with the appropriate front matter added. If the type is not supported, the line is returned as is.
    If the line does not start a new admonition, the line is returned as is.
    """
    global ADMONITION_WHITESPACES
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
        admonition_type, title = "", ""
        match_1 = re.match(r"^>", line)
        if match_1:
            # Checks if its followed by "[!...]"
            match_2 = re.search(r"\[!(.*)\]", line)
            if match_2:
                admonition_type = match_2.group(1)
                # Checks if there is a title "[!...] Title"
                match_3 = re.search(r"\[!(.*)] (.*)", line)
                if match_3:
                    title = match_3.group(2)
            # Count how many whitespaces are between ">" and "["
            ADMONITION_WHITESPACES = line.find("[") - line.find(">")

        if admonition_type:
            if admonition_type == "quote":
                processed_line = ""
                in_quote = True
            elif admonition_type not in SUPPORTED_ADMONITION_TYPES:
                processed_line = line
            else:
                in_admonition = True
                if not title:
                    processed_line = ":::" + admonition_type + "\n"
                else:
                    processed_line = ":::" + admonition_type + " " + title + "\n"
        else:
            processed_line = line

    return processed_line, in_admonition, in_quote


def convert_assets(line):
    match = re.search(r"!\[(?:\|(\d+)(?:x(\d+))?)?\]\((.*?)\)", line)
    if match:
        filename = match.group(3)
        filename = re.sub(" ", "-", filename)
        filename = re.sub("%20", "-", filename)
        file_ending = filename.split(".")[-1]
        filename_clear = filename.split("/")[-1].split(".")[0]
        if file_ending in ("jpg", "png"):
            line = process_images(line, filename_clear, file_ending)

        else:
            line = (
                    "[Download "
                    + filename_clear
                    + "."
                    + file_ending
                    + "]"
                    + "(assets/"
                    + filename_clear
                    + "."
                    + file_ending
                    + ")"
            )
    return line


def process_images(line, filename, file_ending):
    # regular expression to match width and height values after "|"
    pattern = r"\|(\d+)(?:x(\d+))?"
    # checking for size
    resize_match = re.search(pattern, line)

    if resize_match:
        image_width = resize_match.group(1)
        image_height = resize_match.group(2)
        if image_height:
            filename_new = filename + "_w" + image_width + "xh" + image_height
        else:
            filename_new = filename + "_w" + image_width
        new_image_details = {
            "filename": filename + "." + file_ending,
            "filename_new": filename_new,
            "width": image_width,
            "height": image_height,
            "processed": False,
        }
    else:
        new_image_details = {
            "filename": filename + "." + file_ending,
            "filename_new": filename,
            "processed": False,
        }
        filename_new = filename

    already_exists = False
    for image_details in IMAGE_DETAILS:
        if image_details["filename_new"] == new_image_details["filename_new"]:
            already_exists = True
            break

    if not already_exists:
        IMAGE_DETAILS.append(new_image_details)

    return "![](/" + DST_ASSET_SUBFOLDER + "/" + filename_new + "." + CONVERT_IMAGE_TYPE + ")"


def convert_urls(line):
    if "![](assets/" in line:
        line = re.sub("%20", "-", line)
    return re.sub(r"\[(.*?)]\((\.\./)+(.*?)\.md\)", "[\\1](./\\3)", line)


def convert_links(line):
    pattern = r"\[([^\]]+)\]\(([^)]+)\)"
    match = re.search(pattern, line)
    if match:
        url = match.group(2)

        url_parts = url.split("/")
        if url_parts[0].endswith("__blog"):
            url_parts[0] = re.sub("__blog", "", url_parts[0])

        # Makes sure that pdf path gets not converted
        if not url_parts[-1].endswith(".md"):
            return line
        # Remove file ending
        url_parts[-1] = url_parts[-1].split(".")[0]
        # Remove language ending
        url_parts[-1] = url_parts[-1].split(LANGUAGE_SEPERATOR)[0]
        if len(url_parts) > 2:
            # Remove number prefix
            url_parts[-2] = remove_number_prefix(url_parts[-2])
            # Remove whitespace %20 prefix
            url_parts[-2] = remove_whitespace_prefix(url_parts[-2])
            if url_parts[-2] == url_parts[-1]:
                url_parts.pop(-1)
        for i, part in enumerate(url_parts):
            url_parts[i] = convert_whitespaces(part)

        new_url = "/" + "/".join(url_parts)
        line = line.replace(url, new_url)
    return line


def remove_whitespace_prefix(string):
    if string.startswith("%20"):
        string = string[3:]
    return string


def convert_whitespaces(string):
    string = re.sub("%20", "-", string)
    string = re.sub(" ", "-", string)
    return string


def remove_number_prefix(string):
    # Removes all common numbering styles: 1), 1., 1 -, ...
    return re.sub(r"^\d+[\.\-\)\s]*\s*", "", string).strip()


def removes_whitespaces(string):
    re.sub(" ", "", string)


def replace_whitespaces(string):
    re.sub(" ", "_", string)


def convert_excalidraw(line):
    if ".excalidraw]]" in line:
        match = re.search(r"(.+/)(.+)(\.excalidraw)", line)
        file_name = match.group(2)
        file_name = re.sub(" ", "-", file_name)
        line = (
                "![](/" + DST_ASSET_SUBFOLDER + "/"
                + file_name
                + ".excalidraw.dark.svg#dark)\n![](/assets/"
                + file_name
                + ".excalidraw.light.svg#light)\n"
        )
    return line


def convert_svg(line):
    if ".svg]]" in line:
        match = re.search(r"(.+/)(.+)(\.svg)", line)
        file_name = match.group(2)
        file_name = re.sub(" ", "_", file_name)
        line = "![](/" + DST_ASSET_SUBFOLDER + "/" + file_name + ".svg)\n"
    return line


def process_assets(search_folder):
    for file in os.listdir(search_folder):
        dst_dir_path = DST_DIR + "/static/" + DST_ASSET_SUBFOLDER + "/"
        if not os.path.exists(dst_dir_path):
            os.makedirs(os.path.dirname(dst_dir_path))
        if file.endswith(".jpg") or file.endswith(".png"):
            convert_and_resize_image(file, search_folder)
        elif not file.endswith(".excalidraw.md"):
            file_name = convert_whitespaces(file)
            dst_file_path = dst_dir_path + file_name
            shutil.copy(search_folder + "/" + file, dst_file_path)


def convert_and_resize_image(image, src_path):
    filepath = os.path.join(src_path, image)
    img = Image.open(filepath)
    for image_detail in IMAGE_DETAILS:
        if image_detail["filename"] == image:
            width = image_detail.get("width", None)
            height = image_detail.get("height", None)
            if width is not None:
                width = int(width)
            if height is not None:
                height = int(height)
            if img.width > CONVERT_IMAGE_MAX_WIDTH and width is None:
                width = CONVERT_IMAGE_MAX_WIDTH
                height = int(width * img.height / img.width)
            elif width is None and height is None:
                height = img.height
                width = img.width
            elif width is not None and height is None:
                height = int(width * img.height / img.width)
            else:
                width = int(height * img.width / img.height)
            img = img.resize((int(width), int(height)), Resampling.LANCZOS)
            dst_dir_path = DST_DIR + "/static/" + DST_ASSET_SUBFOLDER + "/"
            if not os.path.exists(dst_dir_path):
                os.makedirs(os.path.dirname(dst_dir_path))
            file_name = convert_whitespaces(image_detail["filename_new"])
            dst_file_path = dst_dir_path + file_name + "." + CONVERT_IMAGE_TYPE
            img.save(dst_file_path, CONVERT_IMAGE_TYPE)


main()
