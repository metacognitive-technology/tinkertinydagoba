import json
import re
import math

# 7 primary interstates with a curated list of major cities they serve
interstates = {
    "I-5": {
        "number": 5,
        "direction": "N-S",
        "cities": [
            ("San Diego", "CA"),
            ("Los Angeles", "CA"),
            ("Sacramento", "CA"),
            ("Portland", "OR"),
            ("Seattle", "WA"),
        ],
    },
    "I-10": {
        "number": 10,
        "direction": "E-W",
        "cities": [
            ("Los Angeles", "CA"),
            ("Phoenix", "AZ"),
            ("Tucson", "AZ"),
            ("Las Cruces", "NM"),
            ("El Paso", "TX"),
            ("San Antonio", "TX"),
            ("Houston", "TX"),
            ("Baton Rouge", "LA"),
            ("New Orleans", "LA"),
            ("Mobile", "AL"),
            ("Pensacola", "FL"),
            ("Tallahassee", "FL"),
            ("Jacksonville", "FL"),
        ],
    },
    "I-40": {
        "number": 40,
        "direction": "E-W",
        "cities": [
            ("Barstow", "CA"),
            ("Flagstaff", "AZ"),
            ("Albuquerque", "NM"),
            ("Amarillo", "TX"),
            ("Oklahoma City", "OK"),
            ("Little Rock", "AR"),
            ("Memphis", "TN"),
            ("Nashville", "TN"),
            ("Knoxville", "TN"),
            ("Winston-Salem", "NC"),
            ("Raleigh", "NC"),
            ("Wilmington", "NC"),
        ],
    },
    "I-70": {
        "number": 70,
        "direction": "E-W",
        "cities": [
            ("Denver", "CO"),
            ("Topeka", "KS"),
            ("Kansas City", "MO"),
            ("St. Louis", "MO"),
            ("Indianapolis", "IN"),
            ("Columbus", "OH"),
            ("Wheeling", "WV"),
            ("Pittsburgh", "PA"),
            ("Hagerstown", "MD"),
            ("Baltimore", "MD"),
        ],
    },
    "I-75": {
        "number": 75,
        "direction": "N-S",
        "cities": [
            ("Miami", "FL"),
            ("Fort Lauderdale", "FL"),
            ("Tampa", "FL"),
            ("Atlanta", "GA"),
            ("Chattanooga", "TN"),
            ("Knoxville", "TN"),
            ("Lexington", "KY"),
            ("Cincinnati", "OH"),
            ("Dayton", "OH"),
            ("Toledo", "OH"),
            ("Detroit", "MI"),
            ("Sault Ste. Marie", "MI"),
        ],
    },
    "I-80": {
        "number": 80,
        "direction": "E-W",
        "cities": [
            ("San Francisco", "CA"),
            ("Sacramento", "CA"),
            ("Reno", "NV"),
            ("Salt Lake City", "UT"),
            ("Cheyenne", "WY"),
            ("Omaha", "NE"),
            ("Des Moines", "IA"),
            ("Davenport", "IA"),
            ("Chicago", "IL"),
            ("Gary", "IN"),
            ("Toledo", "OH"),
            ("Cleveland", "OH"),
            ("Youngstown", "OH"),
            ("New York City", "NY"),
        ],
    },
    "I-95": {
        "number": 95,
        "direction": "N-S",
        "cities": [
            ("Miami", "FL"),
            ("Fort Lauderdale", "FL"),
            ("West Palm Beach", "FL"),
            ("Daytona Beach", "FL"),
            ("Jacksonville", "FL"),
            ("Savannah", "GA"),
            ("Florence", "SC"),
            ("Fayetteville", "NC"),
            ("Richmond", "VA"),
            ("Washington", "DC"),
            ("Baltimore", "MD"),
            ("Wilmington", "DE"),
            ("Philadelphia", "PA"),
            ("Newark", "NJ"),
            ("New York City", "NY"),
            ("New Haven", "CT"),
            ("Providence", "RI"),
            ("Boston", "MA"),
            ("Portsmouth", "NH"),
            ("Portland", "ME"),
        ],
    },
}


def make_city_id(name: str, state: str) -> str:
    """
    Normalize city + state to a GraphSON-safe vertex id:
    "San Diego", "CA" -> "city:San_Diego_CA"
    """
    base = re.sub(r"[^A-Za-z0-9]+", "_", f"{name}_{state}").strip("_")
    return f"city:{base}"


# Approximate city center coordinates (lat, lon) in degrees
# for all cities used above.
city_coords = {
    ("San Diego", "CA"): (32.7157, -117.1611),
    ("Los Angeles", "CA"): (34.0522, -118.2437),
    ("Sacramento", "CA"): (38.5816, -121.4944),
    ("Portland", "OR"): (45.5152, -122.6784),
    ("Seattle", "WA"): (47.6062, -122.3321),

    ("Phoenix", "AZ"): (33.4484, -112.0740),
    ("Tucson", "AZ"): (32.2226, -110.9747),
    ("Las Cruces", "NM"): (32.3199, -106.7637),
    ("El Paso", "TX"): (31.7619, -106.4850),
    ("San Antonio", "TX"): (29.4241, -98.4936),
    ("Houston", "TX"): (29.7604, -95.3698),
    ("Baton Rouge", "LA"): (30.4515, -91.1871),
    ("New Orleans", "LA"): (29.9511, -90.0715),
    ("Mobile", "AL"): (30.6954, -88.0399),
    ("Pensacola", "FL"): (30.4213, -87.2169),
    ("Tallahassee", "FL"): (30.4383, -84.2807),
    ("Jacksonville", "FL"): (30.3322, -81.6557),

    ("Barstow", "CA"): (34.8958, -117.0173),
    ("Flagstaff", "AZ"): (35.1983, -111.6513),
    ("Albuquerque", "NM"): (35.0844, -106.6504),
    ("Amarillo", "TX"): (35.221997, -101.831299),
    ("Oklahoma City", "OK"): (35.4676, -97.5164),
    ("Little Rock", "AR"): (34.7465, -92.2896),
    ("Memphis", "TN"): (35.1495, -90.0490),
    ("Nashville", "TN"): (36.1627, -86.7816),
    ("Knoxville", "TN"): (35.9606, -83.9207),
    ("Winston-Salem", "NC"): (36.0999, -80.2442),
    ("Raleigh", "NC"): (35.7796, -78.6382),
    ("Wilmington", "NC"): (34.2257, -77.9447),

    ("Denver", "CO"): (39.7392, -104.9903),
    ("Topeka", "KS"): (39.0473, -95.6752),
    ("Kansas City", "MO"): (39.0997, -94.5786),
    ("St. Louis", "MO"): (38.6270, -90.1994),
    ("Indianapolis", "IN"): (39.7684, -86.1581),
    ("Columbus", "OH"): (39.9612, -82.9988),
    ("Wheeling", "WV"): (40.0630, -80.7209),
    ("Pittsburgh", "PA"): (40.4406, -79.9959),
    ("Hagerstown", "MD"): (39.6418, -77.7200),
    ("Baltimore", "MD"): (39.2904, -76.6122),

    ("Miami", "FL"): (25.7617, -80.1918),
    ("Fort Lauderdale", "FL"): (26.1224, -80.1373),
    ("Tampa", "FL"): (27.9506, -82.4572),
    ("Atlanta", "GA"): (33.7490, -84.3880),
    ("Chattanooga", "TN"): (35.0456, -85.3097),
    ("Lexington", "KY"): (38.0406, -84.5037),
    ("Cincinnati", "OH"): (39.1031, -84.5120),
    ("Dayton", "OH"): (39.7589, -84.1916),
    ("Toledo", "OH"): (41.6528, -83.5379),
    ("Detroit", "MI"): (42.3314, -83.0458),
    ("Sault Ste. Marie", "MI"): (46.4953, -84.3453),

    ("San Francisco", "CA"): (37.7749, -122.4194),
    ("Reno", "NV"): (39.5296, -119.8138),
    ("Salt Lake City", "UT"): (40.7608, -111.8910),
    ("Cheyenne", "WY"): (41.1400, -104.8202),
    ("Omaha", "NE"): (41.2565, -95.9345),
    ("Des Moines", "IA"): (41.5868, -93.6250),
    ("Davenport", "IA"): (41.5236, -90.5776),
    ("Chicago", "IL"): (41.8781, -87.6298),
    ("Gary", "IN"): (41.5934, -87.3464),
    ("Cleveland", "OH"): (41.4993, -81.6944),
    ("Youngstown", "OH"): (41.0998, -80.6495),
    ("New York City", "NY"): (40.7128, -74.0060),

    ("West Palm Beach", "FL"): (26.7153, -80.0534),
    ("Daytona Beach", "FL"): (29.2108, -81.0228),
    ("Savannah", "GA"): (32.0809, -81.0912),
    ("Florence", "SC"): (34.1954, -79.7626),
    ("Fayetteville", "NC"): (35.0527, -78.8784),
    ("Richmond", "VA"): (37.5407, -77.4360),
    ("Washington", "DC"): (38.9072, -77.0369),
    ("Wilmington", "DE"): (39.7447, -75.5484),
    ("Philadelphia", "PA"): (39.9526, -75.1652),
    ("Newark", "NJ"): (40.7357, -74.1724),
    ("New Haven", "CT"): (41.3083, -72.9279),
    ("Providence", "RI"): (41.8240, -71.4128),
    ("Boston", "MA"): (42.3601, -71.0589),
    ("Portsmouth", "NH"): (43.0718, -70.7626),
    ("Portland", "ME"): (43.6591, -70.2568),
}


def haversine_miles(lat1, lon1, lat2, lon2) -> float:
    """
    Great-circle distance between two points (lat/lon in degrees).
    Returns miles.
    """
    # Earth radius in miles
    R = 3958.8

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))

    return R * c


def get_segment_length_miles(
    interstate_name: str,
    city1_name: str,
    city1_state: str,
    city2_name: str,
    city2_state: str,
) -> float:
    """
    Compute approximate segment length using great-circle distance
    between the two city centers.
    """
    key1 = (city1_name, city1_state)
    key2 = (city2_name, city2_state)

    if key1 not in city_coords or key2 not in city_coords:
        # Fallback if any coordinates are missing
        print(
            f"[WARN] Missing coordinates for segment on {interstate_name}: "
            f"{city1_name}, {city1_state} -> {city2_name}, {city2_state}"
        )
        return 0.0

    lat1, lon1 = city_coords[key1]
    lat2, lon2 = city_coords[key2]
    return haversine_miles(lat1, lon1, lat2, lon2)


def build_graph_elements():
    graph_elements = []

    # 1) Interstate vertices
    for hwy, data in interstates.items():
        vid = f"interstate:{hwy}"
        props = {
            "name": [
                {"id": f"{vid}|name", "value": hwy}
            ],
            "number": [
                {"id": f"{vid}|number", "value": data["number"]}
            ],
            "direction": [
                {"id": f"{vid}|direction", "value": data["direction"]}
            ],
        }
        graph_elements.append(
            {
                "id": vid,
                "label": "interstate",
                "type": "vertex",
                "properties": props,
            }
        )

    # 2) City vertices (deduplicated across all routes, now including lat/lon)
    cities = {}
    for _, data in interstates.items():
        for name, state in data["cities"]:
            cid = make_city_id(name, state)
            if cid not in cities:
                cities[cid] = {"name": name, "state": state}

    for cid in sorted(cities.keys()):
        info = cities[cid]
        city_key = (info["name"], info["state"])

        # Look up coordinates if available
        if city_key in city_coords:
            lat, lon = city_coords[city_key]
        else:
            print(f"[WARN] No coordinates for {info['name']}, {info['state']}")
            lat, lon = None, None

        props = {
            "name": [
                {"id": f"{cid}|name", "value": info["name"]}
            ],
            "state": [
                {"id": f"{cid}|state", "value": info["state"]}
            ],
            "latitude": [
                {"id": f"{cid}|latitude", "value": lat}
            ],
            "longitude": [
                {"id": f"{cid}|longitude", "value": lon}
            ],
        }

        graph_elements.append(
            {
                "id": cid,
                "label": "city",
                "type": "vertex",
                "properties": props,
            }
        )

    # 3) City-to-city path edges along each interstate
    for hwy, data in interstates.items():
        city_list = data["cities"]
        interstate_number = data["number"]

        for seq in range(len(city_list) - 1):
            (name1, state1) = city_list[seq]
            (name2, state2) = city_list[seq + 1]
            cid1 = make_city_id(name1, state1)
            cid2 = make_city_id(name2, state2)

            length_miles = get_segment_length_miles(
                hwy, name1, state1, name2, state2
            )

            edge_id = f"edge:{hwy}:{seq}-{seq+1}"

            graph_elements.append(
                {
                    "id": edge_id,
                    "label": hwy,    # ←──────────── the FIX
                    "type": "edge",
                    "outV": cid1,
                    "outVLabel": "city",
                    "inV": cid2,
                    "inVLabel": "city",
                    "properties": {
                        "interstate": hwy,
                        "interstate_number": interstate_number,
                        "length_miles": length_miles,
                        "sequence": seq,
                    },
                }
            )

    return graph_elements


if __name__ == "__main__":
    graph_elements = build_graph_elements()

    num_vertices = sum(1 for e in graph_elements if e["type"] == "vertex")
    num_edges = sum(1 for e in graph_elements if e["type"] == "edge")

    output_file = "us_primary_interstates_path.graphson"
    with open(output_file, "w", encoding="utf-8") as f:
        # Write one GraphSON element per line (no surrounding array)
        for elem in graph_elements:
            json.dump(elem, f, separators=(",", ":"))
            f.write("\n")

    print(
        f"Wrote {len(graph_elements)} GraphSON elements "
        f"({num_vertices} vertices, {num_edges} edges) "
        f"to {output_file}"
    )