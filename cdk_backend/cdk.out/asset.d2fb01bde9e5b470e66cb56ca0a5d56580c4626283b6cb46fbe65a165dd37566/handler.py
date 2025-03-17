import os
import io
import csv
import json
import time
import boto3
import requests
from bs4 import BeautifulSoup

# Environment variables for your S3 bucket and AWS region
BUCKET_NAME = os.environ.get("BUCKET_NAME")
REGION = os.environ.get("REGION")

s3_client = boto3.client("s3", region_name=REGION)

def scrape_inmate_view(base_url, inmate_nn):
    """
    (Detail scraping function; not used in this version.)
    """
    view_url = f"{base_url}/view"
    payload = {"nn": inmate_nn}
    response = requests.post(view_url, data=payload)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    details = {}

    current_booking_h1 = soup.find("h1", text=lambda t: t and "Current Booking" in t)
    if current_booking_h1:
        current_booking_container = current_booking_h1.find_next("div", class_="list")
        booking_h2 = current_booking_container.find("h2")
        if booking_h2 and "Booking #" in booking_h2.text:
            details["current_booking_number"] = booking_h2.text.strip().split("#", 1)[-1].strip()
        info_rows = current_booking_container.find_all("div", class_="row")
        offenses_h3 = current_booking_container.find("h3", text=lambda t: t and "Offenses" in t)
        for row in info_rows:
            if offenses_h3 and offenses_h3 in row.find_all():
                break
            b = row.find("b", class_="uk-visible-small")
            li = row.find("li")
            if b and li:
                label = b.get_text(strip=True).replace(":", "")
                value = li.get_text(strip=True)
                if "Date Booked" in label:
                    details["current_booking_date_booked(MM/DD/YYYY)"] = value
                elif "Date Released" in label:
                    details["current_booking_date_released(MM/DD/YYYY)"] = value
                elif "Scheduled Release Date" in label:
                    details["current_booking_scheduled_release_date(MM/DD/YYYY)"] = value
        details["offenses"] = []
        if offenses_h3:
            offenses_container = offenses_h3.find_next("div", class_="list")
            if offenses_container:
                offense_panels = offenses_container.find_all("div", class_="uk-width-1 uk-panel", recursive=False)
                for panel in offense_panels:
                    rows = panel.find_all("div", class_="row")
                    if len(rows) == 6:
                        agency = rows[0].find("li").get_text(strip=True) if rows[0].find("li") else ""
                        offense = rows[1].find("li").get_text(strip=True) if rows[1].find("li") else ""
                        cause_num = rows[2].find("li").get_text(strip=True) if rows[2].find("li") else ""
                        offense_stat = rows[3].find("li").get_text(strip=True) if rows[3].find("li") else ""
                        bond = rows[4].find("li").get_text(strip=True) if rows[4].find("li") else ""
                        bond_amount = rows[5].find("li").get_text(strip=True) if rows[5].find("li") else ""
                        offense_data = {
                            "agency": agency,
                            "offense": offense,
                            "cause_number": cause_num,
                            "offense_status": offense_stat,
                            "bond": bond,
                            "bond_amount": bond_amount
                        }
                        details["offenses"].append(offense_data)

    booking_list_h1 = soup.find("h1", text=lambda t: t and "Booking List" in t)
    details["booking_list"] = []
    if booking_list_h1:
        booking_list_container = booking_list_h1.find_next("div", class_="list")
        if booking_list_container:
            booking_panels = booking_list_container.find_all("div", class_="uk-width-1 uk-panel", recursive=False)
            for panel in booking_panels:
                rows = panel.find_all("div", class_="row")
                if len(rows) == 4:
                    booking_number = rows[0].find("li").get_text(strip=True) if rows[0].find("li") else ""
                    date_booked = rows[1].find("li").get_text(strip=True) if rows[1].find("li") else ""
                    date_released = rows[2].find("li").get_text(strip=True) if rows[2].find("li") else ""
                    release_type = rows[3].find("li").get_text(strip=True) if rows[3].find("li") else ""
                    booking_data = {
                        "booking_number": booking_number,
                        "date_booked(MM/DD/YYYY)": date_booked,
                        "date_released(MM/DD/YYYY)": date_released,
                        "release_type": release_type
                    }
                    details["booking_list"].append(booking_data)
    time.sleep(1)
    return details

def scrape_score_jail(roster_url, base_url):
    """
    Fetches the main roster page and builds inmate data with already renamed keys.
    """
    response = requests.get(roster_url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')

    inmate_panels = soup.find_all("div", class_="uk-width-1 uk-panel", recursive=False)
    all_inmates = []
    for panel in inmate_panels:
        rows = panel.find_all("div", class_="row")
        if len(rows) < 9:
            continue

        name_number_lis = rows[0].find_all("li")
        name_number = name_number_lis[0].get_text(strip=True) if name_number_lis else ""
        last_name = rows[1].find("li").get_text(strip=True)
        first_name = rows[2].find("li").get_text(strip=True)
        middle_name = rows[3].find("li").get_text(strip=True)
        booking_number = rows[4].find("li").get_text(strip=True)
        date_booked = rows[5].find("li").get_text(strip=True)
        date_released = rows[6].find("li").get_text(strip=True)
        scheduled_release = rows[7].find("li").get_text(strip=True)
        vine_link_li = rows[8].find("li")
        vine_a_tag = vine_link_li.find("a", href=True) if vine_link_li else None
        vine_link = vine_a_tag["href"] if vine_a_tag else ""

        # Build inmate data with keys already renamed for CSV
        inmate_data = {
            "name_number": name_number,
            "last_name": last_name,
            "first_name": first_name,
            "middle_name": middle_name,
            "booking_number": booking_number,
            "date_booked(MM/DD/YYYY)": date_booked,
            "date_released(MM/DD/YYYY)": date_released,
            "scheduled_release_date(MM/DD/YYYY)": scheduled_release,
            "vine_link": vine_link
        }

        # [COMMENTED OUT] Only scrape main page data; additional details not fetched.
        # additional_details = scrape_inmate_view(base_url, name_number)
        # inmate_data.update(additional_details)
        all_inmates.append(inmate_data)
        time.sleep(1)
    return all_inmates

def convert_to_csv_string(data):
    """
    Converts the list of dictionaries to a CSV string.
    Assumes the keys are already in the desired format.
    """
    if not data:
        return ""
    headers = list(data[0].keys())
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in data:
        # For nested structures, serialize as JSON strings
        if "offenses" in row and isinstance(row["offenses"], list):
            row["offenses"] = json.dumps(row["offenses"])
        if "booking_list" in row and isinstance(row["booking_list"], list):
            row["booking_list"] = json.dumps(row["booking_list"])
        writer.writerow(row)
    return output.getvalue()

def lambda_handler(event, context):
    try:
        base_url = "https://jils.scorejail.org"
        roster_url = f"{base_url}/roster"
        all_inmates_data = scrape_score_jail(roster_url, base_url)
        csv_content = convert_to_csv_string(all_inmates_data)
        if not csv_content:
            return {
                "statusCode": 200,
                "body": "No inmate data found."
            }
        file_key = "score_jail_data.csv"
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_key,
            Body=csv_content
        )
        return {
            "statusCode": 200,
            "body": f"Successfully scraped data and uploaded '{file_key}' to bucket '{BUCKET_NAME}'."
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": f"An error occurred: {str(e)}"
        }
