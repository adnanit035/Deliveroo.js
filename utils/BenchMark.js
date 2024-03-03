/*
calculate the manhattan distance between two points (x1, y1) and (x2, y2) for the A* algorithm to find the shortest path between two points for 
*/
const L1Distance = ({x: x1, y: y1}, {x: x2, y: y2}) => {
    const dx = Math.abs(Math.round(x1) - Math.round(x2));
    const dy = Math.abs(Math.round(y1) - Math.round(y2));
    return dx + dy;
};

export {
    L1Distance
};
