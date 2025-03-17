import os
import io
import csv
import boto3
import requests
from bs4 import BeautifulSoup

# Environment variables
BUCKET_NAME = os.environ.get("BUCKET_NAME")
REGION = os.environ.get("REGION")

s3_client = boto3.client("s3", region_name=REGION)

def lambda_handler(event, context):
    try:
        # URL to scrape
        url = "https://www.cdcr.ca.gov/capital-punishment/condemned-inmate-list-secure-request/"
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for non-200 responses

        soup = BeautifulSoup(response.content, 'html.parser')
        table = soup.find('table', class_='has-fixed-layout')
        if not table:
            raise ValueError("Could not find the table with class 'has-fixed-layout'.")

        # Extract original headers
        headers = [th.text.strip() for th in table.find('thead').find_all('th')]

        # Rename headers with underscores and date formats
        renamed_headers = []
        for h in headers:
            if h == "Last Name":
                renamed_headers.append("last_name")
            elif h == "First Name":
                renamed_headers.append("first_name")
            elif h == "Age":
                renamed_headers.append("age")
            elif h == "Age at Offense":
                renamed_headers.append("age_at_offense")
            elif h == "Received Date":
                renamed_headers.append("received_date(MM/DD/YYYY)")
            elif h == "Sentenced Date":
                renamed_headers.append("sentenced_date(MM/DD/YYYY)")
            elif h == "Offense Date":
                renamed_headers.append("offense_date(MM/DD/YYYY)")
            elif h == "Trial County":
                renamed_headers.append("trial_county")
            else:
                # Fallback for unexpected headers
                renamed_headers.append(h.lower().replace(" ", "_"))

        # Extract data rows
        rows = []
        for tr in table.find('tbody').find_all('tr'):
            cells = [td.text.strip() for td in tr.find_all('td')]
            rows.append(cells)

        # Write CSV to an in-memory buffer
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow(renamed_headers)
        writer.writerows(rows)

        # Upload CSV to S3
        file_key = "condemned_inmate_list.csv"
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_key,
            Body=csv_buffer.getvalue()
        )

        return {
            "statusCode": 200,
            "body": f"CSV file '{file_key}' has been created and uploaded to bucket '{BUCKET_NAME}'."
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": f"An error occurred: {str(e)}"
        }
