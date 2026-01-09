/** Robust and fancy string comparison, idfk man. */
function strngCmp(a, b) {
    a = a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    b = b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (a < b) return -1;
    else if (b < a) return 1;
    else return 0;
}

/** Checks if [min1, max1] and [min2, max2] intersect. */
function intervalsIntersect(min1, max1, min2, max2) {
    return (min1 == null || max2 == null || min1 <= max2) && (min2 == null || max1 == null || min2 <= max1);
}

/** Checks if x is in [min, max]. */
function inInterval(min, x, max) {
    return (min == null || min <= x) && (max == null || x <= max);
}
