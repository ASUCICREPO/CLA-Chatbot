import os
import io
import csv
import boto3
import requests
from bs4 import BeautifulSoup

# Environment variables for S3 bucket and region
BUCKET_NAME = os.environ.get("BUCKET_NAME")
REGION = os.environ.get("REGION")

s3_client = boto3.client("s3", region_name=REGION)

# URL of the webpage to scrape
url = "https://www.cdcr.ca.gov/capital-punishment/condemned-inmate-summary-report/"

def fetch_webpage(url):
    """
    Fetch the HTML content of the webpage, forcing UTF-8 encoding.
    """
    response = requests.get(url)
    response.encoding = "utf-8"
    if response.status_code == 200:
        return response.text
    else:
        raise Exception(f"Failed to load page: {response.status_code}")

def fix_encoding_issues(text):
    """
    Replace some known funky sequences with their correct characters.
    """
    replacements = {
        "‚Äì": "–",  # en dash
        "â€“": "–",  # en dash
        "â€”": "—",  # em dash
        "Â": ""      # stray char
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text

def extract_tables(soup):
    """
    Extract tables from the HTML based on section headings.
    """
    tables = {}
    target_sections = ["Ethnicity", "Age Range", "Year Received", "Sentencing County"]
    headings = soup.find_all("h2", class_="wp-block-heading")
    for heading in headings:
        section_title = heading.text.strip()
        if section_title in target_sections:
            figure = heading.find_next("figure", class_="wp-block-table")
            if figure:
                table = figure.find("table")
                if table:
                    normalized_title = section_title.lower().replace(" ", "_")
                    tables[normalized_title] = table
    return tables

def extract_table_data(table):
    """
    Extract headers and data rows from a table, applying encoding fixes.
    """
    headers = [fix_encoding_issues(th.text.strip()) for th in table.find("thead").find_all("th")]
    rows = []
    for tr in table.find("tbody").find_all("tr"):
        cells = [fix_encoding_issues(td.text.strip()) for td in tr.find_all("td")]
        if cells:
            rows.append(cells)
    return headers, rows

def post_process_table(section, headers, rows):
    """
    Update header names and fix the total row for the given table based on its section.
    """
    mapping = {
        "ethnicity":          ["ethnicity", "total_count", "overall_percent", "male_total", "male_percent", "female_total", "female_percent"],
        "age_range":          ["age_range", "total_count", "overall_percent", "male_total", "male_percent", "female_total", "female_percent"],
        "year_received":      ["year", "total_count", "overall_percent", "male_total", "male_percent", "female_total", "female_percent"],
        "sentencing_county":  ["county", "total_count", "overall_percent", "male_total", "male_percent", "female_total", "female_percent"]
    }
    new_headers = mapping.get(section, headers)
    
    # Remove the last row if it exists (assumed to be the total row)
    if rows:
        rows = rows[:-1]
    
    return new_headers, rows

def save_csv_to_s3(headers, rows, filename):
    """
    Save table data as a CSV file to S3.
    """
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    
    s3_client.put_object(Bucket=BUCKET_NAME, Key=filename, Body=csv_buffer.getvalue())
    print(f"Uploaded {filename} to S3 bucket {BUCKET_NAME}")

def lambda_handler(event, context):
    try:
        html = fetch_webpage(url)
        soup = BeautifulSoup(html, "html.parser")
        tables = extract_tables(soup)
        
        for section, table in tables.items():
            headers, rows = extract_table_data(table)
            if headers and rows:
                headers, rows = post_process_table(section, headers, rows)
                filename = f"{section}.csv"
                save_csv_to_s3(headers, rows, filename)
            else:
                print(f"No data found for {section}")
        return {"status": "Success"}
    
    except Exception as e:
        print(f"An error occurred: {e}")
        return {"status": "Error", "message": str(e)}
