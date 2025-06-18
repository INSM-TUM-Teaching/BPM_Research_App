from __future__ import annotations

import itertools
import math
import re
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set, Tuple

from lxml import etree

SRC  = Path("/Users/anisha/Downloads/BPM_Research_App/outputs/20250618_195426_1CEC5585_9198_457A_B4AE_4592A7923597/best_result/example_event_log.bpmn") 
DEST = Path("/Users/anisha/Downloads/BPM_Research_App/outputs/20250618_195426_1CEC5585_9198_457A_B4AE_4592A7923597/best_result/output.bpmn")                     

NS = {
    "bpmn":   "http://www.omg.org/spec/BPMN/20100524/MODEL",
    "bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
    "di":     "http://www.omg.org/spec/DD/20100524/DI",
    "dc":     "http://www.omg.org/spec/DD/20100524/DC",
}
BPMN, BPMNDI, DI, DC = (NS[p] for p in ("bpmn", "bpmndi", "di", "dc"))
q = lambda ns, tag: f"{{{ns}}}{tag}"      

# Default sizes
TASK_W, TASK_H       = 120, 80
EVENT_W, EVENT_H     = 36, 36
GATEWAY_W, GATEWAY_H = 50, 50
DEFAULT_W, DEFAULT_H = 120, 80

# Layout parameters
X_START, Y_START = 50,  50   # top-left origin
X_STEP           = 200       # horizontal distance between nodes on same level
Y_STEP           = 130       # vertical distance between levels
CANVAS_WIDTH     = 1200      # virtual canvas – used for centering

if not hasattr(itertools, "pairwise"):
    def _pairwise(iterable):
        a, b = itertools.tee(iterable)
        next(b, None)
        return zip(a, b)
    itertools.pairwise = _pairwise 

_ref_attr_re = re.compile(r"(Ref$|^default$|^sourceRef$|^targetRef$)")

def get_element_dimensions(element: etree._Element) -> Tuple[int, int]:
    """Return the width/height tuple appropriate for a BPMN element tag."""
    tag = etree.QName(element).localname
    if tag in {
        "task", "userTask", "serviceTask", "scriptTask", "businessRuleTask",
        "sendTask", "receiveTask", "manualTask", "callActivity", "subProcess",
    }:
        return TASK_W, TASK_H
    if tag in {
        "startEvent", "endEvent",
        "intermediateCatchEvent", "intermediateThrowEvent",
    }:
        return EVENT_W, EVENT_H
    if tag in {
        "exclusiveGateway", "parallelGateway", "inclusiveGateway",
        "complexGateway", "eventBasedGateway",
    }:
        return GATEWAY_W, GATEWAY_H
    return DEFAULT_W, DEFAULT_H

def rect_border_intersection(
    *,
    center_x: float,
    center_y: float,
    rect_x: float,
    rect_y: float,
    rect_w: float,
    rect_h: float,
    toward_x: float,
    toward_y: float,
) -> Tuple[float, float]:
    
    dx, dy = toward_x - center_x, toward_y - center_y
    if dx == dy == 0:
        return center_x, rect_y  
    hits: List[Tuple[float, float, float]] = []

    if dx:
        for x_edge in (rect_x, rect_x + rect_w):
            t = (x_edge - center_x) / dx
            if t >= 0:
                y_hit = center_y + dy * t
                if rect_y <= y_hit <= rect_y + rect_h:
                    hits.append((x_edge, y_hit, t))
    if dy:
        for y_edge in (rect_y, rect_y + rect_h):
            t = (y_edge - center_y) / dy
            if t >= 0:
                x_hit = center_x + dx * t
                if rect_x <= x_hit <= rect_x + rect_w:
                    hits.append((x_hit, y_edge, t))

    if not hits:
        return center_x, center_y
    ix, iy, _ = min(hits, key=lambda h: h[2])
    return ix, iy

def circle_border_intersection(
    cx: float,
    cy: float,
    r: float,
    toward_x: float,
    toward_y: float,
) -> Tuple[int, int]:
   
    dx, dy = toward_x - cx, toward_y - cy
    dist = math.hypot(dx, dy) or 1.0 
    scale = r / dist
    return int(cx + dx * scale), int(cy + dy * scale)

def calc_border_connection(
    src_coord: Tuple[int, int],
    tgt_coord: Tuple[int, int],
    src_dim:   Tuple[int, int],
    tgt_dim:   Tuple[int, int],
) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    
    (sx, sy), (tx, ty) = src_coord, tgt_coord
    (sw, sh), (tw, th) = src_dim, tgt_dim
    src_cx, src_cy = sx + sw / 2.0, sy + sh / 2.0
    tgt_cx, tgt_cy = tx + tw / 2.0, ty + th / 2.0

    way_src = rect_border_intersection(
        center_x=src_cx, center_y=src_cy,
        rect_x=sx, rect_y=sy, rect_w=sw, rect_h=sh,
        toward_x=tgt_cx, toward_y=tgt_cy,
    )
    way_tgt = rect_border_intersection(
        center_x=tgt_cx, center_y=tgt_cy,
        rect_x=tx, rect_y=ty, rect_w=tw, rect_h=th,
        toward_x=src_cx, toward_y=src_cy,
    )
    return (int(way_src[0]), int(way_src[1])), (int(way_tgt[0]), int(way_tgt[1]))

def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"[ERROR] Input BPMN not found: {SRC}")
    print(f"→ Input : {SRC}")
    print(f"→ Output: {DEST}")

    parser = etree.XMLParser(remove_blank_text=True)
    tree   = etree.parse(str(SRC), parser)
    root   = tree.getroot()

    process = root.find(".//bpmn:process", namespaces=NS)
    if process is None:
        raise RuntimeError("<bpmn:process> element missing!")

    clean_incoming_outgoing_texts(process)
    rename_clashing_sequence_flows(process)
    auto_create_missing_flows(process)

    for old_di in root.findall("bpmndi:BPMNDiagram", namespaces=NS):
        root.remove(old_di)

    build_flow_based_diagram(root, process)

    tree.write(str(DEST), encoding="UTF-8",
               pretty_print=True, xml_declaration=True)
    print("✓ Diagram successfully generated.")

def clean_incoming_outgoing_texts(process: etree._Element) -> None:
    """Strip whitespace from <incoming>/<outgoing> text contents."""
    for el in process.iter():
        if el.tag in {q(BPMN, "incoming"), q(BPMN, "outgoing")} and el.text:
            el.text = el.text.strip()

def rename_clashing_sequence_flows(process: etree._Element) -> None:
    """
    If a sequenceFlow ID collides with a task/gateway/etc. ID,
    rename it to Flow_auto_N and update every reference.
    """
    node_ids = {e.get("id")
                for e in process
                if e.tag != q(BPMN, "sequenceFlow") and e.get("id")}
    id_map: Dict[str, str] = {}

    for idx, flow in enumerate(
            process.findall("bpmn:sequenceFlow", namespaces=NS), start=1):
        fid = flow.get("id")
        if fid in node_ids:
            new_id = f"Flow_auto_{idx}"
            id_map[fid] = new_id
            flow.set("id", new_id)

    if not id_map:
        return

    for el in process.iter():
        
        for attr, val in list(el.attrib.items()):
            if _ref_attr_re.search(attr) and val in id_map:
                el.set(attr, id_map[val])
       
        if el.tag in {q(BPMN, "incoming"), q(BPMN, "outgoing")} and el.text in id_map:
            el.text = id_map[el.text]

def auto_create_missing_flows(process: etree._Element) -> None:
    """
    If the BPMN model contains *no* sequence flows, create a simple linear chain
    following XML order—just to avoid an entirely disconnected diagram.
    """
    if process.findall("bpmn:sequenceFlow", namespaces=NS):
        return
    nodes = [e for e in process
             if e.get("id") and e.tag != q(BPMN, "sequenceFlow")]
    for idx, (src, tgt) in enumerate(itertools.pairwise(nodes), start=1):
        etree.SubElement(process, q(BPMN, "sequenceFlow"),
                         id=f"Flow_auto_{idx}",
                         sourceRef=src.get("id"),
                         targetRef=tgt.get("id"))


def build_flow_based_diagram(root: etree._Element,
                             process: etree._Element) -> None:
    """Generate <bpmndi:*> diagram elements with a tidy top-down layout."""
    diag  = etree.SubElement(root, q(BPMNDI, "BPMNDiagram"),
                             id=f"D_{uuid.uuid4().hex}")
    plane = etree.SubElement(diag, q(BPMNDI, "BPMNPlane"),
                             id=f"Pl_{uuid.uuid4().hex}",
                             bpmnElement=process.get("id"))

    
    elements: Dict[str, etree._Element] = {}
    flows: Dict[str, Tuple[str, str]]   = {}
    incoming: Dict[str, List[str]]      = defaultdict(list)
    outgoing: Dict[str, List[str]]      = defaultdict(list)

    for el in process:
        if el.tag == q(BPMN, "sequenceFlow"):
            fid, src, tgt = el.get("id"), el.get("sourceRef"), el.get("targetRef")
            if fid and src and tgt:
                flows[fid] = (src, tgt)
                outgoing[src].append(tgt)
                incoming[tgt].append(src)
        else:
            nid = el.get("id")
            if nid:
                elements[nid] = el

    start_nodes = [n for n in elements if not incoming[n]]

    level: Dict[str, int] = {}
    visited: Set[str] = set()

    def assign(node: str, lvl: int, stack: Set[str]) -> None:
        if node in stack:              
            return
        level[node] = max(level.get(node, 0), lvl)
        if node in visited:
            return
        visited.add(node)
        for child in outgoing[node]:
            assign(child, lvl + 1, stack | {node})

    for s in start_nodes:
        assign(s, 0, set())

    max_lvl = max(level.values()) if level else 0
    for n in elements:
        if n not in level:
            max_lvl += 1
            level[n] = max_lvl

    groups: Dict[int, List[str]] = defaultdict(list)
    for nid, lvl in level.items():
        groups[lvl].append(nid)

    coords: Dict[str, Tuple[int, int]] = {}
    for lvl in sorted(groups):
        grp = groups[lvl]
        y   = Y_START + lvl * Y_STEP
        if len(grp) == 1:
            nid = grp[0]
            parents = incoming.get(nid, [])
            if parents and any(p in coords for p in parents):
                xs = [coords[p][0] + get_element_dimensions(elements[p])[0] / 2.0
                      for p in parents if p in coords]
                x = int(sum(xs) / len(xs) - get_element_dimensions(elements[nid])[0] / 2.0)
            else:
                x = X_START + (CANVAS_WIDTH - 2 * X_START) // 2
            coords[nid] = (x, y)
        else:
            total = (len(grp) - 1) * X_STEP + max(TASK_W, EVENT_W, GATEWAY_W)
            start_x = X_START + max((CANVAS_WIDTH - 2 * X_START - total) // 2, 0)
            for i, nid in enumerate(grp):
                coords[nid] = (start_x + i * X_STEP, y)

    for nid, (x, y) in coords.items():
        w, h = get_element_dimensions(elements[nid])
        shape = etree.SubElement(plane, q(BPMNDI, "BPMNShape"),
                                 id=f"sh_{nid}", bpmnElement=nid)
        etree.SubElement(shape, q(DC, "Bounds"),
                         x=str(x), y=str(y), width=str(w), height=str(h))

    for fid, (src_id, tgt_id) in flows.items():
        if src_id not in coords or tgt_id not in coords:
            continue

        edge = etree.SubElement(plane, q(BPMNDI, "BPMNEdge"),
                                id=f"ed_{fid}", bpmnElement=fid)

        sx, sy = coords[src_id]
        tx, ty = coords[tgt_id]
        sw, sh = get_element_dimensions(elements[src_id])
        tw, th = get_element_dimensions(elements[tgt_id])

        tag_src = etree.QName(elements[src_id]).localname
        tag_tgt = etree.QName(elements[tgt_id]).localname

        if tag_src.endswith("Event"):
            way_src = circle_border_intersection(
                sx + sw / 2.0, sy + sh / 2.0, sw / 2.0,
                tx + tw / 2.0, ty + th / 2.0,
            )
        else:
            way_src = tuple(map(int, rect_border_intersection(
                center_x=sx + sw / 2.0, center_y=sy + sh / 2.0,
                rect_x=sx, rect_y=sy, rect_w=sw, rect_h=sh,
                toward_x=tx + tw / 2.0, toward_y=ty + th / 2.0,
            )))

        if tag_tgt.endswith("Event"):
            way_tgt = circle_border_intersection(
                tx + tw / 2.0, ty + th / 2.0, tw / 2.0,
                sx + sw / 2.0, sy + sh / 2.0,
            )
        else:
            way_tgt = tuple(map(int, rect_border_intersection(
                center_x=tx + tw / 2.0, center_y=ty + th / 2.0,
                rect_x=tx, rect_y=ty, rect_w=tw, rect_h=th,
                toward_x=sx + sw / 2.0, toward_y=sy + sh / 2.0,
            )))

        etree.SubElement(edge, q(DI, "waypoint"),
                         x=str(way_src[0]), y=str(way_src[1]))
        etree.SubElement(edge, q(DI, "waypoint"),
                         x=str(way_tgt[0]), y=str(way_tgt[1]))


if __name__ == "__main__":
    main()