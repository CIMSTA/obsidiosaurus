import re
import os
import shutil


def main(secondary_language_code=None):
    input_directory = "F:/doci_test"
    output_directory = "F:/doci_test_converted/"

    # Language variables
    i18n_supported = True
    main_language = "en"
    secondary_languages = ["de", "fr", "es"]
    language_separator = "__"
    secondary_languages_codes = []
    for language in secondary_languages:
        secondary_languages_codes.append(language_separator + language)
    main_language_code = language_separator + main_language

    convert_urls = True
    convert_diagrams = True
    convert_excalidraw = True
    convert_adomonition = True

    # Create output directory, delete if already exists
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
    else:
        shutil.rmtree(output_directory)

    # Search for markdown files and convert them
    for root, dirs, files in os.walk(input_directory):
        for file in files:
            if file.endswith(".md"):
                input_file = os.path.join(root, file)
                rel_path = os.path.relpath(input_file, input_directory)

                # Main language or default
                rel_path = re.sub(main_language_code, "", rel_path)
                output_file = os.path.join(output_directory, os.path.join("docs", rel_path))
                # Secondary languages
                if i18n_supported:
                    for code in secondary_languages_codes:
                        code_md = code + ".md"
                        if file.endswith(code_md):
                            rel_path = re.sub(code, "", rel_path)
                            i18n_directory = "i18n/{}/docusaurus-plugin-content-docs/current/".format(code[2:])
                            output_file = os.path.join(output_directory, os.path.join(i18n_directory, rel_path))
                            if not os.path.exists(os.path.dirname(output_file)):
                                os.makedirs(os.path.dirname(output_file))

                if not os.path.exists(os.path.dirname(output_file)):
                    os.makedirs(os.path.dirname(output_file))
                convert_file(input_file, output_file)

    # Copy directory to output path
    input_asset_directory = os.path.join(input_directory, "assets")
    output_asset_directory = os.path.join(os.path.join(output_directory, "static"), "assets")
    if os.path.exists(input_asset_directory):
        shutil.copytree(input_asset_directory, output_asset_directory)
        # Remove whitespaces from excalidraw files
        for file_name in os.listdir(output_asset_directory):
            # rename files
            if file_name.endswith(".excalidraw.svg") or file_name.endswith(".excalidraw.png") or file_name.endswith(
                    ".svg"):
                new_file_name = re.sub(" ", "_", file_name)
                os.rename(os.path.join(output_asset_directory, file_name),
                          os.path.join(output_asset_directory, new_file_name))
            # delete .excalidraw.md files
            if file_name.endswith(".excalidraw") or file_name.endswith(".excalidraw.md") or file_name.endswith(
                    ".svg.xml"):
                os.remove(os.path.join(output_asset_directory, file_name))


def convert_file(input_file, output_file):
    # Open the input file and read it line by line
    with open(input_file, 'r') as file:
        lines = file.readlines()

    # Open the output file
    with open(output_file, 'w') as file:
        in_admonition = False
        for line in lines:
            line = process_urls(line)
            line = process_assets(line)
            line = process_excalidraw(line)
            line = process_diagrams(line)
            line, in_admonition = process_admonition(file, line, in_admonition)


def process_admonition(file, line, in_admonition):
    if in_admonition:
        # If we're in an admonition, check for the end of the block
        if line == '\n':
            in_admonition = False
            file.write(':::\n\n')
        else:
            file.write(line[2:])
    else:
        # If we're not in an admonition, check for the start of a new one
        match = re.match(r'>\s\[!(.*)] (.*)', line)
        if match:
            in_admonition = True
            file.write(':::' + match.group(1) + ' ' + match.group(2) + '\n')
        else:
            file.write(line)
    return line, in_admonition


def process_urls(line):
    if "__de" or "__en" in line:
        line = re.sub("__de", "", line)
        line = re.sub("__en", "", line)
    return re.sub(r"\[(.*?)]\((\.\./)+(.*?)\.md\)", "[\\1](./\\3)", line)


def process_assets(line):
    if "assets/" in line:
        line = line.replace("assets/", "/assets/")
    return line


def process_excalidraw(line):
    if ".excalidraw]]" in line:
        match = re.search(r'(.+/)(.+)(\.excalidraw)', line)
        file_name = match.group(2)
        file_name = re.sub(" ", "_", file_name)
        line = "![](/assets/" + file_name + ".excalidraw.dark.svg#dark)\n![](/assets/" + file_name + ".excalidraw.light.svg#light)\n"
    return line


def process_diagrams(line):
    if ".svg]]" in line:
        match = re.search(r'(.+/)(.+)(\.svg)', line)
        file_name = match.group(2)
        file_name = re.sub(" ", "_", file_name)
        line = "![](/assets/" + file_name + ".svg)\n"
    return line


main()
