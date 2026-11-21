"""Implement Zabbix-style XML data mapping without enabling DTDs or network access."""
import json
import sys

try:
    from lxml import etree
except ImportError:
    sys.exit("XML support requires Python 3 with lxml installed.")


def decode(node):
    fields = {"@" + key: value for key, value in node.attrib.items()}
    for child in node:
        key = child.tag
        value = decode(child)
        if key not in fields:
            fields[key] = value
        elif isinstance(fields[key], list):
            fields[key].append(value)
        else:
            fields[key] = [fields[key], value]
    text = (node.text or "").strip()
    if not fields:
        return text or None
    if text:
        fields["#text"] = text
    return fields


def encode(name, value):
    node = etree.Element(name)
    if isinstance(value, dict):
        for key, item in value.items():
            if key.startswith("@"):
                node.set(key[1:], str(item))
            elif key == "#text":
                node.text = str(item)
            else:
                for child in item if isinstance(item, list) else [item]:
                    node.append(encode(key, child))
    elif value is not None:
        node.text = value if isinstance(value, str) else json.dumps(value)
    return node


def process(request):
    data = request["data"]
    if request["operation"] == "fromJson":
        obj = json.loads(data) if isinstance(data, str) else data
        if not isinstance(obj, dict) or len(obj) != 1:
            raise ValueError("XML requires exactly one root element.")
        return etree.tostring(encode(*next(iter(obj.items()))), encoding="unicode")
    parser = etree.XMLParser(resolve_entities=False, no_network=True, remove_comments=True, remove_pis=True)
    root = etree.fromstring(data.encode(), parser)
    if root.getroottree().docinfo.doctype:
        raise ValueError("DTD declarations are not supported.")
    if request["operation"] == "toJson":
        return json.dumps({root.tag: decode(root)}, ensure_ascii=False)
    result = root.xpath(request["expression"])
    if isinstance(result, list):
        if not result:
            return None
        return "".join(etree.tostring(item, encoding="unicode", with_tail=False)
                       if isinstance(item, etree._Element) else str(item) for item in result)
    if isinstance(result, bool):
        return "true" if result else "false"
    return format(result, ".15g") if isinstance(result, float) else result


if __name__ == "__main__":
    try:
        print(json.dumps(process(json.load(sys.stdin))))
    except (ValueError, TypeError, etree.Error) as error:
        sys.exit(str(error))
