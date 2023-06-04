import os
import re
from pathlib import Path
from src.utils import check_i18n_grouping, check_language, convert_whitespaces, write_log_file, remove_number_prefix, remove_whitespace_prefix, build_rel_dst_path
from src.image_converter import IMAGE_DETAILS, SVG_DETAILS
from loguru import logger


def process_markdown(search_folder, CONTENT_TYPE, CONTENT_NAME, config):
    global I18N_SUPPORTED, SIDEBAR, SUPPORTED_ADMONITION_TYPES, DST_ASSET_SUBFOLDER, CONVERT_IMAGE_TYPE, LANGUAGE_SEPERATOR
    SRC_DIR = Path(config['vault_directory'])
    DST_DIR = Path(config['docusaurus_directory'])
    LOG_FILE = Path(config['log_file_path'])
    SUPPORTED_ADMONITION_TYPES = config['supported_admonitation_types']
    SIDEBAR = []
    DST_ASSET_SUBFOLDER = config['docusaurus_asset_subfolder_name']
    CONVERT_IMAGE_TYPE = config['converted_image_type']
    LANGUAGE_SEPERATOR = config['language_separator']
    I18N_SUPPORTED = bool(config['i18n_supported'])
    
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
                language, secondary_language = check_language(file_name, config)
                new_file_name = splitted_path[-1]
                for i, part in enumerate(splitted_path):
                    splitted_path[i] = convert_whitespaces(part)
                # Build the final dest path where the file should be copied to
                path = "/".join(splitted_path)
                
                rel_dst_file_path = build_rel_dst_path(
                    path, language, secondary_language, CONTENT_TYPE, CONTENT_NAME, config['docusaurus_asset_subfolder_name']
                ) 
                abs_dst_file_path = DST_DIR / rel_dst_file_path[1:]
                # Checks if the folder where to copy is already created
                dst_dir = os.path.dirname(abs_dst_file_path)
                os.makedirs(dst_dir, exist_ok=True)
                convert_file(abs_src_file_path, abs_dst_file_path, CONTENT_TYPE)
                write_log_file(new_file_name, rel_dst_file_path, DST_DIR, LOG_FILE)
                
                
                
def convert_file(input_file, output_file, CONTENT_TYPE):
    # Open the input file and read it line by line
    with open(input_file, "r", encoding="utf-8") as file:
        lines = file.readlines()

    # Open the output file
    with open(output_file, "w", encoding="utf-8") as file:
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
    # Regular expression to match width and height values after "|"
    pattern = r"\|(\d+)(?:x(\d+))?"
    resize_match = re.search(pattern, line)
    logger.debug(f"🔎 Found image in: {line}")
    
    new_image_details = {
        "filename": f"{filename}.{file_ending}",
        "processed": False,
    }

    if resize_match:
        image_width = resize_match.group(1)
        image_height = resize_match.group(2)

        if image_height:
            filename_new = f"{filename}_w{image_width}xh{image_height}"
        else:
            filename_new = f"{filename}_w{image_width}"

        new_image_details.update({
            "filename_new": filename_new,
            "width": image_width,
            "height": image_height,
        })
    else:
        new_image_details["filename_new"] = filename
        filename_new = filename

    already_exists = any(image_detail["filename_new"] == new_image_details["filename_new"] for image_detail in IMAGE_DETAILS)

    if not already_exists:
        IMAGE_DETAILS.append(new_image_details)

    string = f"![](/{DST_ASSET_SUBFOLDER}/{filename_new}.{CONVERT_IMAGE_TYPE})"
    logger.debug(f"🟢 Processed image string: {string}")
    
    return string



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


def convert_excalidraw(line):
    if ".excalidraw]]" in line:
        match = re.search(r"(.+/)(.+)(\.excalidraw)", line)
        file_name = match.group(2)
        file_name = re.sub(" ", "-", file_name)
        line = (
            "![](/"
            + DST_ASSET_SUBFOLDER
            + "/"
            + file_name
            + ".excalidraw.dark.svg#dark)\n![](/assets/"
            + file_name
            + ".excalidraw.light.svg#light)\n"
        )
        logger.debug(line)
    return line


def convert_svg(line):
    if ".svg]]" in line:
        match = re.search(r"!\[\[(.+/)(.+)(\.svg)\]\]", line)
        if match:
            file_name = match.group(2)
            file_name = re.sub(" ", "-", file_name) 

            if file_name not in SVG_DETAILS:
                SVG_DETAILS.append(file_name)
                logger.debug(f"Appended: {file_name}")

            line = (
                "![](/"
                + DST_ASSET_SUBFOLDER
                + "/"
                + file_name
                + ".dark.svg#dark)\n![](/assets/"
                + file_name
                + ".light.svg#light)\n"
            )
            logger.debug(line)
        else:
            logger.error(f"Unexpected line format: {line}")
    return line

