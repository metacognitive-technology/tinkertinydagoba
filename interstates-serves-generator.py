import json
import re

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

    # 2) City vertices (deduplicated across all routes)
    cities = {}
    for _, data in interstates.items():
        for name, state in data["cities"]:
            cid = make_city_id(name, state)
            if cid not in cities:
                cities[cid] = {"name": name, "state": state}

    for cid in sorted(cities.keys()):
        info = cities[cid]
        props = {
            "name": [
                {"id": f"{cid}|name", "value": info["name"]}
            ],
            "state": [
                {"id": f"{cid}|state", "value": info["state"]}
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

    # 3) Interstate -> City edges, with a 'sequence' property
    for hwy, data in interstates.items():
        outV = f"interstate:{hwy}"
        for seq, (name, state) in enumerate(data["cities"]):
            cid = make_city_id(name, state)
            edge_id = f"edge:{hwy}:{seq}"
            graph_elements.append(
                {
                    "id": edge_id,
                    "label": "serves",
                    "type": "edge",
                    "outV": outV,
                    "outVLabel": "interstate",
                    "inV": cid,
                    "inVLabel": "city",
                    "properties": {
                        "sequence": seq
                    },
                }
            )

    return graph_elements


if __name__ == "__main__":
    graph_elements = build_graph_elements()

    num_vertices = sum(1 for e in graph_elements if e["type"] == "vertex")
    num_edges = sum(1 for e in graph_elements if e["type"] == "edge")

    output_file = "us_primary_interstates_graph.graphson"
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