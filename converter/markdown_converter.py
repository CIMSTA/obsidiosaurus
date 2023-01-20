"""
Convert markdown files from obsidian to docusaurus
"""
import re
import os
import shutil

# Sidebar
multi_sidebar: bool = True
sidebars = ["Tekla", "Revit"]

# Language variables
i18n_supported: bool = True
language_separator: str = "__"
main_language: str = "en"
main_language_code: str = ""
secondary_languages = ["de", "fr", "es"]
secondary_languages_codes = []

# Function  variables
convert_urls: bool = True
convert_diagrams: bool = True
convert_excalidraw: bool = True
convert_adomonition: bool = True

def main(secondary_language_code=None):
    input_directory = "F:/doci_test"
    output_directory = "G:/CIMSTA/docs"

    # Language Code Setup
    for language in secondary_languages:
        secondary_languages_codes.append(language_separator + language)
    main_language_code = language_separator + main_language

    # Create output directory, delete if already exists
    output_directory_docs = output_directory + "/docs"
    if os.path.exists(output_directory_docs):
        shutil.rmtree(output_directory_docs)

    for lang in secondary_languages:
        output_directory_i18n = (
            output_directory + "/i18n/{}/docusaurus-plugin-content-docs/".format(lang)
        )
        if os.path.exists(output_directory_i18n):
            shutil.rmtree(output_directory_i18n)

    output_directory_assets = output_directory + "/static/assets"
    if os.path.exists(output_directory_assets):
        shutil.rmtree(output_directory_assets)

    # Search for markdown files and convert them
    for root, dirs, files in os.walk(input_directory):
        for file in files:
            if file.endswith(".md") and not file.endswith("excalidraw.md"):
                input_file = os.path.join(root, file)
                relative_path = os.path.relpath(input_file, input_directory)

                # Main language or default
                relative_path = re.sub(main_language_code, "", relative_path)
                first_folder = relative_path.split(os.path.sep)[0]
                output_file = os.path.join(
                    output_directory, os.path.join("docs", relative_path)
                )
                # Secondary languages
                if i18n_supported:
                    for code in secondary_languages_codes:
                        code_md = code + ".md"
                        if file.endswith(code_md):
                            relative_path = re.sub(code, "", relative_path)
                            i18n_directory = "i18n/{}/docusaurus-plugin-content-docs/current/".format(
                                code[2:]
                            )
                            output_file = os.path.join(
                                output_directory,
                                os.path.join(i18n_directory, relative_path),
                            )

                if not os.path.exists(os.path.dirname(output_file)):
                    os.makedirs(os.path.dirname(output_file))
                convert_file(input_file, output_file, first_folder)

    # Copy directory to output path
    input_asset_directory = os.path.join(input_directory, "assets")
    output_asset_directory = os.path.join(
        os.path.join(output_directory, "static"), "assets"
    )
    if os.path.exists(input_asset_directory):
        shutil.copytree(input_asset_directory, output_asset_directory)
        # Remove whitespaces from excalidraw files
        for file_name in os.listdir(output_asset_directory):
            # rename files
            new_file_name = re.sub(" ", "_", file_name)
            os.rename(
                os.path.join(output_asset_directory, file_name),
                os.path.join(output_asset_directory, new_file_name),
            )
            # delete .excalidraw.md files
            if convert_excalidraw and (
                file_name.endswith(".excalidraw")
                or file_name.endswith(".excalidraw.md")
                or file_name.endswith(".svg.xml")
            ):
                os.remove(os.path.join(output_asset_directory, new_file_name))


def convert_file(input_file, output_file, first_folder):
    # Open the input file and read it line by line
    with open(input_file, "r") as file:
        lines = file.readlines()

    # Open the output file
    with open(output_file, "w") as file:
        in_admonition = False
        sidebar_checked = False

        for line in lines:
            if multi_sidebar and not sidebar_checked:
                if line == "---\n":
                    line = "---\ndisplayed_sidebar: " + first_folder + "\n"
                else:
                    old_line = line
                    line = "---\ndisplayed_sidebar: " + first_folder +"\n---\n" + old_line
                print(line)
                sidebar_checked = True
            line = process_urls(line)
            line = process_assets(line)
            line = process_excalidraw(line)
            line = process_diagrams(line)
            line, in_admonition = process_admonition(file, line, in_admonition)


def process_admonition(file, line, in_admonition):
    if in_admonition:
        # If we're in an admonition, check for the end of the block
        if line == "\n":
            in_admonition = False
            file.write(":::\n\n")
        else:
            file.write(line[2:])
    else:
        # If we're not in an admonition, check for the start of a new one
        match = re.match(r">\s\[!(.*)] (.*)", line)
        if match:
            in_admonition = True
            file.write(":::" + match.group(1) + " " + match.group(2) + "\n")
        else:
            file.write(line)
    return line, in_admonition


def process_urls(line):
    if i18n_supported:
        for code in secondary_languages_codes:
            if code in line:
                line = re.sub("code", "", line)

    if "![](assets/" in line:
        line = re.sub("%20", "_", line)
    return re.sub(r"\[(.*?)]\((\.\./)+(.*?)\.md\)", "[\\1](./\\3)", line)


def process_assets(line):
    match = re.search(r"!\[\]\(assets\/(.*)\.(.*)\)", line)
    if match:
        filename = match.group(1)
        file_ending = match.group(2)
        if file_ending == "jpg" or file_ending == "png":
            line = "![](assets/" + filename + "." + file_ending + ")"
        else:
            line = (
                "[Download "
                + filename
                + "."
                + file_ending
                + "]"
                + "(assets/"
                + filename
                + "."
                + file_ending
                + ")"
            )
    if "assets/" in line:
        line = line.replace("assets/", "/assets/")
    return line


def process_excalidraw(line):
    if ".excalidraw]]" in line:
        match = re.search(r"(.+/)(.+)(\.excalidraw)", line)
        file_name = match.group(2)
        file_name = re.sub(" ", "_", file_name)
        line = (
            "![](/assets/"
            + file_name
            + ".excalidraw.dark.svg#dark)\n![](/assets/"
            + file_name
            + ".excalidraw.light.svg#light)\n"
        )
    return line


def process_diagrams(line):
    if ".svg]]" in line:
        match = re.search(r"(.+/)(.+)(\.svg)", line)
        file_name = match.group(2)
        file_name = re.sub(" ", "_", file_name)
        line = "![](/assets/" + file_name + ".svg)\n"
    return line


main()
