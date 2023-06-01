from datetime import datetime
import re

def write_log_file(file_name, final_rel_path, DST_DIR, LOG_FILE):
    with open(LOG_FILE, "a", encoding="utf-8") as file:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        file.write(f"{now},{file_name},{final_rel_path}\n")
        
        
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


def check_language(name, config):
    MAIN_LANGUAGE = config['main_language']
    SECONDARY_LANGUAGES = config['secondary_languages']
    LANGUAGE_SEPERATOR = config['language_separator']

    """
    Checks if the file name is in the format <file_name><LANGUAGE_SEPERATOR><language_code>.
    note__en.md, note__de.md
    If yes, returns the language code and a boolean indicating if the language is a secondary language.
    If not, returns the main language and False.
    """
    name_split = name.split(LANGUAGE_SEPERATOR)
    if len(name_split) > 1:
        language = name_split[1]
        # Returns e.g. "fr" and "True" if French is defined as secondary language
        return language, language in SECONDARY_LANGUAGES
    return MAIN_LANGUAGE, False


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


def build_rel_dst_path(path, language, secondary_language, CONTENT_TYPE, CONTENT_NAME, DST_ASSET_SUBFOLDER):
    
    """
    Construct a relative file path for various content types in Docusaurus.

    The content type can be one of the following:
    - Base Docs: `docs_base`
    - Base Blog: `blog_base`
    - Multi Instance Blog: `blog_multi`
    """

    if CONTENT_TYPE == "docs_base":
        # Base Docs:
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + path
        else:
            # root / i18n / [locale] / docusaurus - plugin - content - docs
            rel_path = (
                "/i18n/{}/docusaurus-plugin-content-docs/current/".format(language)
                + path
            )

    elif CONTENT_TYPE == "blog_base":
        # Base Blog:
        # root/i18n/[locale]/docusaurus-plugin-content-blog
        if not secondary_language:
            rel_path = "/" + CONTENT_NAME + "/" + path
        else:
            rel_path = (
                "/i18n/{}/docusaurus-plugin-content-blog/".format(language) + path
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