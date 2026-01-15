import provinces from "../../assets/locations/provinces.json";
import DISTRICTS from "./districtsIndex";
import WARDS from "./wardsIndex";

const cache = {
    districts: new Map(),
    wards: new Map(),
};

export function getProvinces() {
    // provinces.json thường là array
    return Array.isArray(provinces) ? provinces : (provinces?.data || []);
}

export function getDistrictsByProvinceCode(provinceCode) {
    const code = String(provinceCode || "").trim();
    if (!code) return [];

    if (cache.districts.has(code)) return cache.districts.get(code);

    const mod = DISTRICTS[code];
    const data = mod ? (mod.default ?? mod) : []; // JSON module
    const list = Array.isArray(data) ? data : (data?.data || []);
    cache.districts.set(code, list);
    return list;
}

export function getWardsByDistrictCode(districtCode) {
    const code = String(districtCode || "").trim();
    if (!code) return [];

    if (cache.wards.has(code)) return cache.wards.get(code);

    const mod = WARDS[code];
    const data = mod ? (mod.default ?? mod) : [];
    const list = Array.isArray(data) ? data : (data?.data || []);
    cache.wards.set(code, list);
    return list;
}

// ✅ tiện cho “điền nhanh” (lọc theo tên)
export function filterByKeyword(list, keyword, pickName = (x) => x?.name) {
    const q = String(keyword || "").trim().toLowerCase();
    if (!q) return list;
    return (list || []).filter((x) => String(pickName(x) || "").toLowerCase().includes(q));
}
