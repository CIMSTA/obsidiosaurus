import re
import os
import shutil


def main():
    input_directory = r"F:\doci_test"
    output_directory = r"F:\doci_test_converted"

    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
    else:
        shutil.rmtree(output_directory)

    for root, dirs, files in os.walk(input_directory):
        for file in files:
            if file.endswith('.md'):
                input_file = os.path.join(root, file)
                rel_path = os.path.relpath(input_file, input_directory)
                output_file = os.path.join(os.path.join(output_directory, "docs"), rel_path)

                if not os.path.exists(os.path.dirname(output_file)):
                    os.makedirs(os.path.dirname(output_file))

                convert_file(input_file, output_file)

    if os.path.exists(os.path.join(input_directory, "assets")):
        shutil.copytree(os.path.join(input_directory, "assets"), os.path.join(os.path.join(output_directory, "static"), "assets"))


def convert_file(input_file, output_file):
    # Open the input file and read it line by line
    with open(input_file, 'r') as file:
        lines = file.readlines()

    # Open the output file
    with open(output_file, 'w') as file:
        in_admonition = False
        for line in lines:
            line = check_urls(line)
            line = check_assets(line)
            if in_admonition:
                # If we're in an admonition, check for the end of the block
                if line == '\n':
                    in_admonition = False
                    file.write(':::\n\n')
                else:
                    file.write(line[2:])
            else:
                # If we're not in an admonition, check for the start of a new one
                match = re.match(r'>\s\[!(.*)\] (.*)', line)
                if match:
                    in_admonition = True
                    file.write(':::' + match.group(1) + ' ' + match.group(2) + '\n')
                else:
                    file.write(line)


def check_urls(line):
    return re.sub(r"\[(.*?)\]\((\.\.\/)+(.*?)\.md\)" , "[\\1](./\\3)", line)


def check_assets(line):
    if "assets/" in line:
        line = line.replace("assets/", "/assets/")
    return line


main()
