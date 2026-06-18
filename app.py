import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# Simple in-memory cache
feed_cache = {
    "data": None,
    "last_fetched": 0,
    "error": None
}

CACHE_TTL = 300  # Cache for 5 minutes

def parse_html_sections(html_content):
    """
    Parses the feed's HTML content, splitting it into separate updates based on <h3> tags.
    For example: <h3>Feature</h3><p>...</p> becomes a list of sections.
    """
    if not html_content:
        return []
    
    html_content = html_content.strip()
    
    # Extract headings (h3) and the content following them
    # Pattern: <h3>Heading</h3> Content up to the next <h3> or end of string
    pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', re.DOTALL | re.IGNORECASE)
    matches = pattern.findall(html_content)
    
    sections = []
    
    # If there is content before the first h3, add it as a general section
    first_h3_match = re.search(r'<h3', html_content, re.IGNORECASE)
    if first_h3_match:
        start_idx = first_h3_match.start()
        prefix = html_content[:start_idx].strip()
        if prefix:
            sections.append({
                "type": "General",
                "body": prefix
            })
            
    for title, body in matches:
        sections.append({
            "type": title.strip(),
            "body": body.strip()
        })
        
    if not sections:
        # Fallback if no h3 elements are found
        sections.append({
            "type": "Update",
            "body": html_content
        })
        
    return sections

def get_release_notes(force_refresh=False):
    """
    Fetches the BigQuery release notes XML feed, parses it, and caches the result.
    """
    now = time.time()
    
    # If we have cached data, the cache hasn't expired, and we aren't forcing a refresh, return the cache.
    if not force_refresh and feed_cache["data"] and (now - feed_cache["last_fetched"] < CACHE_TTL):
        return feed_cache["data"], None

    try:
        # Create request with a browser-like User-Agent
        req = urllib.request.Request(
            FEED_URL,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        namespaces = {'ns': 'http://www.w3.org/2005/Atom'}
        
        entries = root.findall('ns:entry', namespaces)
        parsed_entries = []
        
        for entry in entries:
            entry_id = entry.find('ns:id', namespaces)
            title = entry.find('ns:title', namespaces)
            updated = entry.find('ns:updated', namespaces)
            content_el = entry.find('ns:content', namespaces)
            
            entry_id_text = entry_id.text if entry_id is not None else ""
            title_text = title.text if title is not None else "Unknown Date"
            updated_text = updated.text if updated is not None else ""
            content_html = content_el.text if content_el is not None else ""
            
            # Parse sections (multiple updates in a single entry)
            sections = parse_html_sections(content_html)
            
            # Parse links inside sections and find a general link if available
            fallback_link = "https://cloud.google.com/bigquery/docs/release-notes"
            
            parsed_entries.append({
                "id": entry_id_text,
                "date_str": title_text,
                "updated": updated_text,
                "sections": sections,
                "link": fallback_link
            })
            
        feed_cache["data"] = parsed_entries
        feed_cache["last_fetched"] = now
        feed_cache["error"] = None
        return parsed_entries, None

    except Exception as e:
        error_msg = f"Failed to fetch feed: {str(e)}"
        print(error_msg)
        
        # If fetch fails but we have cached data, return cached data with warning
        if feed_cache["data"]:
            return feed_cache["data"], f"{error_msg} (Showing cached data)"
            
        feed_cache["error"] = error_msg
        return None, error_msg

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    releases, error = get_release_notes(force_refresh=force_refresh)
    
    if releases is None:
        return jsonify({"success": False, "error": error}), 500
        
    return jsonify({
        "success": True,
        "releases": releases,
        "error": error,
        "last_fetched": time.strftime('%I:%M:%S %p', time.localtime(feed_cache["last_fetched"]))
    })

if __name__ == '__main__':
    # Running locally, accessible on localhost
    app.run(host='127.0.0.1', port=5000, debug=True)
