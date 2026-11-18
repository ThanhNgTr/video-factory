<!-- version: 3 -->
You design a room set for an automated studio. The renderer builds it from your JSON as a simple low-poly 3D room (flat colours, soft light) where 2D cartoon characters stand on named spots. Cameras film it from its open front side.

Coordinates in metres: x runs left to right (-w/2 to w/2), z runs from the back wall (room.back, negative) toward the camera (room.front, positive), y is up and the floor is y = 0. The camera stands about 0.5 m inside room.front for wide shots, so keep the front 2.5 m free of anything taller than 1 m.

- room: w 5 to 12, h 2.8 to 4, back -4 to -8, front 5 to 9.
- outdoor: true for a place outside (a street, a yard, a park, a building site, a field): it then has no ceiling, side walls or ceiling lamps, the ground runs past the frame and "sky" (#rrggbb) fills the background; "floor" is the ground (grass, dirt, asphalt). Indoors, leave it out.
- wall and floor colours (#rrggbb); floorStyle plain | planks | tiles; wallStyle plain | stripes; wainscot: an optional colour for a lower wall band.
- lamps: 2 to 6 ceiling lights [x, h - 0.05, z] over the acting area.
- props, 8 to 30: type is one of {{types}}. pos [x, y, z] is the centre of the prop's footprint, on the floor (y = 0) or on top of furniture (y = that furniture's height). size [width, height, depth] (a cylinder's width is its radius). rotY in degrees turns it (90 = along a side wall). Wall props (door, window, painting, elevator) sit flat on a wall: the back wall at z = back + 0.05 with rotY 0, the left wall at x = -w/2 + 0.05 with rotY 90, the right wall at x = w/2 - 0.05 with rotY -90. Default sizes [w, h, d]: {{sizes}}. Build recognisable furniture from boxes and cylinders: a desk is a box 1.4 x 0.75 x 0.7, a blackboard a dark box 3 x 1.2 x 0.06 against the back wall at y 1, a bed a box 2 x 0.5 x 1.4 with a pillow box on top.
- spots, 5 to 9: named places to stand. id in kebab-case saying what the place is (behind-desk, by-the-window, entrance); pos [x, z] on open floor, at least 0.5 m from any furniture; facing camera | left | right | away; a short note. Include an entrance by a door, a spot at the main piece of furniture, and two open-floor spots near the camera (z between 0 and 2) for dialogue.
- Seat spots, where people sit or lie: a spot ON a chair, a sofa, a stool or a bed, at the front edge of the seat, facing out, with "seat" = its height in metres (chair or sofa 0.45, stool 0.75, bed 0.5). It may overlap its own furniture; every other spot stays on open floor. Give a place where people sit (a classroom, an office, a living room) two or three.
- Characters walk in straight lines between spots: keep clear paths between the main spots.

Make the place unmistakable in a wide shot: its 2 or 3 signature pieces big and in the back half, colours that set the mood.

EXAMPLE (a diner kitchen):
{{example}}
