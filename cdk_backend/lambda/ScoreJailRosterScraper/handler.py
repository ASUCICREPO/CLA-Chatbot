import os
import json
import time
import csv
import boto3
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# Regex to match date-time strings in "MM/DD/YYYY hh:mm AM/PM" format.
DATETIME_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)", re.IGNORECASE)

def get_with_retry(url, max_retries=3, initial_delay=1, backoff_factor=2, **kwargs):
    """
    Attempts to fetch the given URL with exponential backoff.
    If a request fails, it retries up to max_retries times.
    """
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            print(f"[DEBUG] Attempt {attempt + 1} for URL: {url}")
            response = requests.get(url, **kwargs)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"[DEBUG] Attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                raise e
            time.sleep(delay)
            delay *= backoff_factor

# [ADDED] Helper function to ensure HH:MM:SS
def ensure_hhmmss(time_str: str) -> str:
    """
    Ensures a time string is in HH:MM:SS format by appending ':00' if it's only HH:MM.
    If empty or invalid, returns an empty string.
    """
    if not time_str:
        return ""
    time_str = time_str.strip()
    parts = time_str.split(":")
    if len(parts) == 2:
        return time_str + ":00"
    return time_str  # Already HH:MM:SS or something else.

def post_process_data(data):
    """
    Processes each row from the scraped data:
      - Combines DateBooked(MM/DD/YYYY) into a single datetime field (booking_datetime)
        in ISO format, and also extracts the time in 24-hour format with seconds.
      - Processes DateReleased(MM/DD/YYYY) as a status field.
      - Processes ScheduledReleaseDate(MM/DD/YYYY) by trying to combine date and time 
        into scheduled_release_datetime in ISO format. If parsing fails, marks the field
        as TBD.
    Returns a new list of dictionaries with updated keys.
    """
    processed = []
    for row in data:
        new_row = {}
        # Copy unchanged fields.
        new_row["booking_number"] = row.get("BookingNumber", "")
        new_row["first_name"] = row.get("FirstName", "")
        new_row["last_name"] = row.get("LastName", "")
        new_row["middle_name"] = row.get("MiddleName", "")
        new_row["name_number"] = row.get("NameNumber", "")
        new_row["vine_link"] = row.get("VineLink", "")
        
        # Process DateBooked: Combine date and time into a single datetime.
        date_booked_str = row.get("DateBooked(MM/DD/YYYY)", "").strip()
        try:
            # Expecting format like "MM/DD/YYYY hh:mm AM/PM"
            dt_booked = datetime.strptime(date_booked_str, "%m/%d/%Y %I:%M %p")
            new_row["booking_datetime"] = dt_booked.isoformat()  # ISO format datetime
            # Format time to include seconds (defaulting to 00)
            new_row["booking_time_24hr"] = dt_booked.strftime("%H:%M:%S")
        except ValueError:
            # If conversion fails, save original string and leave booking time empty.
            new_row["booking_datetime"] = date_booked_str
            new_row["booking_time_24hr"] = ""
            # [ADDED] Attempt to salvage a time if it looks like HH:MM
            match = re.search(r"\b(\d{1,2}:\d{2})\b", date_booked_str)
            if match:
                possible_time = match.group(1)
                new_row["booking_time_24hr"] = ensure_hhmmss(possible_time)

        # [ADDED] Debug line for booking_time_24hr
        print(f"[DEBUG] booking_number={new_row['booking_number']} => booking_time_24hr={new_row['booking_time_24hr']}")

        # Process DateReleased: copy as status.
        new_row["date_released"] = row.get("DateReleased(MM/DD/YYYY)", "").strip()

        # Process ScheduledReleaseDate: combine date and time if possible.
        sched_str = row.get("ScheduledReleaseDate(MM/DD/YYYY)", "").strip()
        try:
            dt_sched = datetime.strptime(sched_str, "%m/%d/%Y %I:%M %p")
            new_row["scheduled_release_datetime"] = dt_sched.isoformat()
            new_row["scheduled_release_time_24hr"] = dt_sched.strftime("%H:%M:%S")
            new_row["scheduled_release_tbd"] = False
        except ValueError:
            new_row["scheduled_release_datetime"] = ""
            new_row["scheduled_release_time_24hr"] = ""
            # If the original string is empty or "to be determined", mark as TBD.
            if sched_str.lower() == "to be determined" or sched_str == "":
                new_row["scheduled_release_tbd"] = True
            else:
                new_row["scheduled_release_tbd"] = sched_str
                # [ADDED] Attempt to salvage a time if it looks like HH:MM
                match_sched = re.search(r"\b(\d{1,2}:\d{2})\b", sched_str)
                if match_sched:
                    possible_time = match_sched.group(1)
                    new_row["scheduled_release_time_24hr"] = ensure_hhmmss(possible_time)

        # [ADDED] Debug line for scheduled_release_time_24hr
        print(f"[DEBUG] booking_number={new_row['booking_number']} => scheduled_release_time_24hr={new_row['scheduled_release_time_24hr']}")

        # Preserve nested fields if present.
        if "offenses" in row:
            new_row["offenses"] = row["offenses"]
        if "booking_list" in row:
            new_row["booking_list"] = row["booking_list"]

        processed.append(new_row)
    return processed

def scrape_inmate_view(base_url, inmate_nn):
    """
    Fetches and parses the detailed inmate page at <base_url>/view with POST data {"nn": inmate_nn}.
    Returns a dictionary of the inmate's current booking details, offenses, and booking history.
    """
    print(f"  [DEBUG] Scraping detail view for inmate NN: {inmate_nn}")
    view_url = f"{base_url}/view"
    payload = {"nn": inmate_nn}

    response = requests.post(view_url, data=payload)
    response.raise_for_status()
    soup = BeautifulSoup("", "html.parser")  # Dummy blank soup

    details = {}
    # --- Process "Current Booking" section ---
    current_booking_h1 = soup.find("h1", text=lambda t: t and "Current Booking" in t)
    if current_booking_h1:
        print("    [DEBUG] Found 'Current Booking' section")
        current_booking_container = current_booking_h1.find_next("div", class_="list")
        booking_h2 = current_booking_container.find("h2")
        if booking_h2 and "Booking #" in booking_h2.text:
            details["current_booking_number"] = booking_h2.text.strip().split("#", 1)[-1].strip()
            print(f"      [DEBUG] Current Booking Number: {details['current_booking_number']}")

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
                    details["current_booking_date_booked"] = value
                    print(f"      [DEBUG] Current Booking Date Booked: {value}")
                elif "Date Released" in label:
                    details["current_booking_date_released"] = value
                    print(f"      [DEBUG] Current Booking Date Released: {value}")
                elif "Scheduled Release Date" in label:
                    details["current_booking_scheduled_release_date"] = value
                    print(f"      [DEBUG] Current Booking Scheduled Release Date: {value}")

        details["offenses"] = []
        if offenses_h3:
            print("    [DEBUG] Found 'Offenses' section")
            offenses_container = offenses_h3.find_next("div", class_="list")
            if offenses_container:
                offense_panels = offenses_container.find_all("div", class_="uk-width-1 uk-panel", recursive=False)
                for index, panel in enumerate(offense_panels, start=1):
                    rows = panel.find_all("div", class_="row")
                    if len(rows) == 6:
                        offense_data = {
                            "agency": rows[0].find("li").get_text(strip=True) if rows[0].find("li") else "",
                            "offense": rows[1].find("li").get_text(strip=True) if rows[1].find("li") else "",
                            "cause_number": rows[2].find("li").get_text(strip=True) if rows[2].find("li") else "",
                            "offense_status": rows[3].find("li").get_text(strip=True) if rows[3].find("li") else "",
                            "bond": rows[4].find("li").get_text(strip=True) if rows[4].find("li") else "",
                            "bond_amount": rows[5].find("li").get_text(strip=True) if rows[5].find("li") else ""
                        }
                        details["offenses"].append(offense_data)
                        print(f"      [DEBUG] Offense {index}: {offense_data}")
    else:
        print("    [DEBUG] 'Current Booking' section not found.")

    # --- Process "Booking List" section ---
    booking_list_h1 = soup.find("h1", text=lambda t: t and "Booking List" in t)
    details["booking_list"] = []
    if booking_list_h1:
        print("    [DEBUG] Found 'Booking List' section")
        booking_list_container = booking_list_h1.find_next("div", class_="list")
        if booking_list_container:
            booking_panels = booking_list_container.find_all("div", class_="uk-width-1 uk-panel", recursive=False)
            for index, panel in enumerate(booking_panels, start=1):
                rows = panel.find_all("div", class_="row")
                if len(rows) == 4:
                    booking_data = {
                        "booking_number": rows[0].find("li").get_text(strip=True) if rows[0].find("li") else "",
                        "date_booked(MM/DD/YYYY)": rows[1].find("li").get_text(strip=True) if rows[1].find("li") else "",
                        "date_released(MM/DD/YYYY)": rows[2].find("li").get_text(strip=True) if rows[2].find("li") else "",
                        "release_type": rows[3].find("li").get_text(strip=True) if rows[3].find("li") else ""
                    }
                    details["booking_list"].append(booking_data)
                    print(f"      [DEBUG] Booking History {index}: {booking_data}")
    else:
        print("    [DEBUG] 'Booking List' section not found.")

    time.sleep(1)
    return details

def scrape_score_jail(roster_url, base_url):
    """
    1. Fetch the main roster page.
    2. For each inmate on the roster page, extract top-level info.
    3. Return a list of dictionaries containing all main-page data.
    """
    print(f"[DEBUG] Fetching roster page: {roster_url}")
    response = get_with_retry(roster_url, max_retries=3, initial_delay=1, backoff_factor=2)
    soup = BeautifulSoup(response.text, 'html.parser')
    inmate_panels = soup.find_all("div", class_="uk-width-1 uk-panel")
    print(f"[DEBUG] Found {len(inmate_panels)} inmate panels on roster page")
    all_inmates = []
    for idx, panel in enumerate(inmate_panels, start=1):
        rows = panel.find_all("div", class_="row")
        if len(rows) < 9:
            print(f"  [DEBUG] Skipping panel {idx} due to insufficient rows")
            continue
        inmate_data = {
            "BookingNumber": rows[4].find("li").get_text(strip=True) if rows[4].find("li") else "",
            "DateBooked(MM/DD/YYYY)": rows[5].find("li").get_text(strip=True) if rows[5].find("li") else "",
            "DateReleased(MM/DD/YYYY)": rows[6].find("li").get_text(strip=True) if rows[6].find("li") else "",
            "ScheduledReleaseDate(MM/DD/YYYY)": rows[7].find("li").get_text(strip=True) if rows[7].find("li") else "",
            "FirstName": rows[2].find("li").get_text(strip=True) if rows[2].find("li") else "",
            "LastName": rows[1].find("li").get_text(strip=True) if rows[1].find("li") else "",
            "MiddleName": rows[3].find("li").get_text(strip=True) if rows[3].find("li") else "",
            "NameNumber": rows[0].find_all("li")[0].get_text(strip=True) if rows[0].find_all("li") else "",
            "VineLink": (rows[8].find("li").find("a", href=True)["href"]
                         if rows[8].find("li") and rows[8].find("li").find("a", href=True)
                         else "")
        }
        print(f"[DEBUG] Processing inmate {idx}: NN {inmate_data.get('NameNumber')}, {inmate_data.get('FirstName')} {inmate_data.get('LastName')}")
        # Detailed inmate view scraping is currently disabled.
        # Uncomment the lines below to include detailed inmate view data.
        # additional_details = scrape_inmate_view(base_url, inmate_data["NameNumber"])
        # inmate_data.update(additional_details)
        all_inmates.append(inmate_data)
    print(f"[DEBUG] Completed scraping roster. Total inmates processed: {len(all_inmates)}")
    return all_inmates

def save_to_csv(data, filename):
    """
    Saves the processed inmate data to a CSV file.
    The 'date_released' field is converted to a boolean:
      - True if the value equals "In SCORE Custody"
      - False otherwise.
    
    Args:
        data (list of dict): List of inmate records.
        filename (str): The file path to save the CSV.
    """
    # Convert the "date_released" field to boolean.
    for row in data:
        row["date_released"] = True if row.get("date_released", "").strip() == "In SCORE Custody" else False

    # Define CSV headers without datatype annotations.
    headers = [
        "booking_number",
        "booking_datetime",
        "booking_time_24hr",
        "In_Score_Custody",
        "first_name",
        "last_name",
        "middle_name",
        "name_number",
        "scheduled_release_datetime",
        "scheduled_release_time_24hr",
        "scheduled_release_tbd",
        "vine_link"
    ]

    # Mapping from the original data keys to our new header keys.
    key_mapping = {
        "booking_number": "booking_number",
        "booking_datetime": "booking_datetime",
        "booking_time_24hr": "booking_time_24hr",
        "date_released": "In_Score_Custody",
        "first_name": "first_name",
        "last_name": "last_name",
        "middle_name": "middle_name",
        "name_number": "name_number",
        "scheduled_release_datetime": "scheduled_release_datetime",
        "scheduled_release_time_24hr": "scheduled_release_time_24hr",
        "scheduled_release_tbd": "scheduled_release_tbd",
        "vine_link": "vine_link"
    }

    # Write to CSV.
    with open(filename, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in data:
            new_row = {}
            for orig_key, new_header in key_mapping.items():
                new_row[new_header] = row.get(orig_key, "")
            writer.writerow(new_row)
    print(f"[DEBUG] Data saved successfully to '{filename}'.")


def lambda_handler(event, context):
    """
    AWS Lambda handler that:
      1. Scrapes the main inmate roster from SCORE Jail (without detailed inmate view).
      2. Post-processes date fields and combines date and time into datetime fields.
      3. Saves the result as a CSV in the Lambda environment.
      4. Uploads the CSV to an S3 bucket specified in the environment variables.
      5. Returns a simple status message.
    """
    base_url = "https://jils.scorejail.org"
    roster_url = f"{base_url}/roster"
    print("[DEBUG] Starting scraping process in Lambda...")
    all_inmates_data = scrape_score_jail(roster_url, base_url)

    # Post-process data to combine date and time fields.
    processed_data = post_process_data(all_inmates_data)

    csv_filename = "/tmp/score_jail_data.csv"  # Lambda can write to /tmp
    save_to_csv(processed_data, csv_filename)

    # Retrieve S3 bucket name and region from environment variables.
    bucket_name = os.environ.get('BUCKET_NAME')
    region = os.environ.get('REGION')
    if not bucket_name:
        raise ValueError("BUCKET_NAME environment variable is not set.")
    if not region:
        raise ValueError("REGION environment variable is not set.")

    s3_object_key = "score_jail_data.csv"  # Change the key as desired.
    s3_client = boto3.client("s3", region_name=region)
    s3_client.upload_file(csv_filename, bucket_name, s3_object_key)

    msg = (f"[DEBUG] Saved {len(processed_data)} inmate records to S3 bucket '{bucket_name}' "
           f"with key '{s3_object_key}' in region '{region}'.")
    print(msg)
    return {
        'statusCode': 200,
        'body': msg
    }
