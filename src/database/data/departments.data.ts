// =============================================================================
// Departments per faculty / school
// =============================================================================
// Keyed by the exact faculty/school names used in faculties.data.ts. Canonical
// lists are defined once and reused across the many naming variants Nigerian
// institutions use (Faculty of Engineering / School of Engineering / College
// of Engineering, ...).
// -----------------------------------------------------------------------------

// ------------------------------- UNIVERSITY FACULTIES -------------------------------

const ENG = [
  "Mechanical Engineering",
  "Electrical/Electronic Engineering",
  "Civil Engineering",
  "Computer Engineering",
  "Chemical Engineering",
  "Petroleum Engineering",
  "Agricultural and Bioresources Engineering",
  "Metallurgical and Materials Engineering",
  "Systems Engineering",
  "Biomedical Engineering",
  "Marine Engineering",
  "Mechatronics Engineering",
  "Production Engineering",
  "Food Engineering",
];

const SCI = [
  "Computer Science",
  "Mathematics",
  "Statistics",
  "Physics",
  "Chemistry",
  "Industrial Chemistry",
  "Biochemistry",
  "Microbiology",
  "Geology",
  "Geophysics",
  "Zoology",
  "Botany",
  "Plant Science and Biotechnology",
  "Animal and Environmental Biology",
  "Marine Science",
  "Fisheries and Aquaculture",
  "Industrial Physics",
];

const BIO = [
  "Biochemistry",
  "Microbiology",
  "Plant Science and Biotechnology",
  "Zoology",
  "Animal and Environmental Biology",
  "Cell Biology and Genetics",
  "Genetics and Biotechnology",
  "Botany",
  "Fisheries and Aquaculture",
  "Marine Biology",
];

const PHYS_SCI = [
  "Mathematics",
  "Statistics",
  "Physics",
  "Chemistry",
  "Industrial Chemistry",
  "Computer Science",
  "Geology",
  "Geophysics",
  "Industrial Physics",
  "Pure and Applied Mathematics",
  "Pure and Applied Chemistry",
  "Pure and Applied Physics",
];

const ARTS = [
  "English Language",
  "Linguistics",
  "History and International Studies",
  "Philosophy",
  "Religious Studies",
  "Theatre Arts",
  "Music",
  "Fine and Applied Arts",
  "Archaeology and Tourism",
  "French",
  "Igbo",
  "Yoruba",
  "Hausa",
  "European Languages",
  "Communication Arts",
];

const LAW = [
  "Law",
  "International Law and Jurisprudence",
  "Private and Property Law",
  "Public Law",
  "Business Law",
  "Islamic Law",
  "Criminal Law",
];

const SOC = [
  "Economics",
  "Political Science",
  "Sociology",
  "Psychology",
  "Mass Communication",
  "Geography",
  "History and International Studies",
  "International Relations",
  "Criminology and Security Studies",
  "Demography and Social Statistics",
  "Peace and Conflict Studies",
  "Public Administration",
];

const MGT = [
  "Accounting",
  "Business Administration",
  "Banking and Finance",
  "Marketing",
  "Insurance and Risk Management",
  "Actuarial Science",
  "Entrepreneurship",
  "Public Administration",
  "Industrial Relations and Personnel Management",
  "Cooperative Economics and Management",
  "Procurement and Supply Chain Management",
];

const EDU = [
  "Educational Management",
  "Guidance and Counselling",
  "Curriculum Studies",
  "Educational Technology",
  "Early Childhood Education",
  "Adult Education",
  "Science Education",
  "Social Science Education",
  "Arts Education",
  "Physical and Health Education",
  "Special Education",
  "Library and Information Science",
  "Educational Foundations",
];

const ENV = [
  "Architecture",
  "Urban and Regional Planning",
  "Estate Management",
  "Quantity Surveying",
  "Building",
  "Surveying and Geoinformatics",
  "Geography and Planning",
  "Environmental Management",
  "Environmental Health Science",
];

const AGR = [
  "Agricultural Economics",
  "Agronomy",
  "Crop Science",
  "Animal Science",
  "Soil Science",
  "Agricultural Extension",
  "Food Science and Technology",
  "Forestry and Wildlife Management",
  "Fisheries and Aquaculture",
  "Agricultural Engineering",
  "Horticulture",
  "Plant Protection",
];

const BMS = [
  "Human Anatomy",
  "Human Physiology",
  "Medical Biochemistry",
  "Pharmacology",
  "Medical Microbiology",
  "Haematology and Blood Transfusion",
  "Pathology",
  "Immunology",
];

const CLS = [
  "Medicine and Surgery",
  "Obstetrics and Gynaecology",
  "Paediatrics",
  "Internal Medicine",
  "Surgery",
  "Anaesthesia",
  "Radiology",
  "Ophthalmology",
  "Ear, Nose and Throat",
  "Psychiatry",
  "Family Medicine",
  "Community Medicine",
  "Medical Rehabilitation",
];

const MED = [
  "Medicine and Surgery",
  "Anatomy",
  "Physiology",
  "Biochemistry",
  "Pharmacology",
  "Pathology",
  "Community Medicine",
  "Obstetrics and Gynaecology",
  "Paediatrics",
  "Internal Medicine",
  "Surgery",
  "Psychiatry",
];

const PHR = [
  "Pharmacy",
  "Pharmacology",
  "Pharmaceutical Chemistry",
  "Pharmaceutics",
  "Pharmacognosy",
  "Clinical Pharmacy and Pharmacy Administration",
];

const DEN = [
  "Dentistry and Dental Surgery",
  "Oral and Maxillofacial Surgery",
  "Preventive Dentistry",
  "Restorative Dentistry",
  "Child Dental Health",
  "Oral Pathology",
];

const VET = [
  "Veterinary Medicine",
  "Veterinary Anatomy",
  "Veterinary Physiology",
  "Veterinary Pharmacology",
  "Veterinary Pathology",
  "Veterinary Microbiology",
  "Veterinary Parasitology",
  "Veterinary Public Health and Preventive Medicine",
  "Veterinary Surgery and Radiology",
  "Theriogenology",
  "Animal Production and Health",
];

const COM = [
  "Computer Science",
  "Information Technology",
  "Cyber Security",
  "Software Engineering",
  "Computer and Information Systems",
  "Information and Communication Technology",
  "Data Science",
  "Artificial Intelligence",
];

const CMS = [
  "Mass Communication",
  "Journalism and Media Studies",
  "Broadcasting",
  "Public Relations and Advertising",
  "Film and Multimedia Studies",
];

const NURS = ["Nursing Science"];

const ALLIED = [
  "Medical Laboratory Science",
  "Radiography and Radiation Science",
  "Physiotherapy",
  "Nursing Science",
  "Medical Rehabilitation",
  "Health Information Management",
  "Public Health Science",
  "Human Nutrition and Dietetics",
];

const HLTH = [
  "Medicine and Surgery",
  "Nursing Science",
  "Physiotherapy",
  "Medical Laboratory Science",
  "Radiography",
  "Pharmacy",
  "Public Health",
  "Anatomy",
  "Physiology",
];

const PUBHLTH = [
  "Public Health",
  "Community Health",
  "Epidemiology",
  "Health Promotion and Education",
  "Environmental Health",
  "Nutrition and Dietetics",
];

const TECH = [
  "Food Technology",
  "Wood Products Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical/Electronic Engineering",
  "Agricultural Engineering",
  "Petroleum Engineering",
  "Industrial and Production Engineering",
];

const RNR = [
  "Forestry and Wildlife Management",
  "Fisheries and Aquaculture",
  "Wildlife and Ecotourism Management",
  "Social and Environmental Forestry",
];

const MGMT_TECH = [
  "Management and Entrepreneurship",
  "Project Management Technology",
  "Transport Management Technology",
  "Maritime Management Technology",
  "Financial Management Technology",
  "Production and Operations Management",
];

const FOOD = [
  "Food Science and Technology",
  "Human Nutrition and Dietetics",
  "Hospitality and Tourism Management",
  "Consumer Sciences",
  "Home Economics",
];

const GEOL = [
  "Geology",
  "Applied Geophysics",
  "Mining Engineering",
  "Petroleum Engineering",
  "Earth Sciences",
  "Geoinformatics",
];

const FOOD_HUMAN = [
  "Food Science and Technology",
  "Human Nutrition and Dietetics",
  "Home Science and Management",
  "Family and Consumer Sciences",
  "Food Technology",
];

const CROP_SOIL = [
  "Crop Production",
  "Soil Science",
  "Plant Science",
  "Horticulture",
  "Plant Breeding and Seed Science",
  "Agronomy",
];

const ANIMAL = [
  "Animal Science",
  "Animal Production",
  "Animal Breeding and Genetics",
  "Poultry Science",
  "Ruminant Animal Production",
  "Non-Ruminant Animal Production",
];

const AGRI_ECON = [
  "Agricultural Economics",
  "Agricultural Extension and Rural Development",
  "Rural Sociology",
  "Agribusiness and Marketing",
];

const PLANT_HEALTH = [
  "Plant Pathology",
  "Crop Protection",
  "Entomology",
  "Nematology",
  "Plant Health Management",
];

const ENV_RES = [
  "Forestry and Wildlife Management",
  "Environmental Management",
  "Fisheries and Aquaculture",
  "Ecotourism and Wildlife Management",
];

const PLANT_CROP = [
  "Agronomy",
  "Plant Breeding and Seed Science",
  "Horticulture",
  "Crop Protection",
];

const LIVESTOCK = [
  "Animal Science",
  "Animal Production",
  "Animal Breeding and Genetics",
  "Poultry Science",
  "Livestock Production and Management",
];

const AGRI_RURAL = [
  "Agricultural Economics",
  "Agricultural Extension and Rural Development",
  "Rural Sociology and Development",
  "Agribusiness Management",
];

const ADMIN = [
  "Public Administration",
  "Business Administration",
  "Local Government Studies",
];

const LEADERSHIP = ["Leadership Studies", "Entrepreneurship Studies", "General Studies"];

const MILITARY = [
  "Military Science",
  "Strategic Studies",
  "Peace and Conflict Studies",
  "Security Studies",
];

const TRANSPORT = [
  "Transport Management",
  "Logistics and Supply Chain Management",
  "Maritime Transport",
  "Aviation Management",
];

const VET_EDU = [
  "Business Education",
  "Technical Education",
  "Agricultural Education",
  "Home Economics Education",
  "Computer Education",
  "Industrial Education",
];

const AFIT_ENG = [
  "Aeronautical Engineering",
  "Aircraft Engineering",
  "Avionics",
  "Mechanical Engineering",
  "Electrical/Electronic Engineering",
];

const SECURITY_LAW = [...LAW, "Security Studies", "Criminology"];

// ------------------------------- POLYTECHNIC SCHOOLS -------------------------------

const POLY_ENG = [
  "Mechanical Engineering Technology",
  "Electrical/Electronic Engineering Technology",
  "Civil Engineering Technology",
  "Computer Engineering Technology",
  "Chemical Engineering Technology",
  "Petroleum and Gas Processing",
  "Welding and Fabrication Technology",
  "Foundry Engineering Technology",
  "Marine Engineering Technology",
  "Metallurgical Engineering Technology",
];

const POLY_SCI = [
  "Computer Science",
  "Statistics",
  "Science Laboratory Technology",
  "Food Technology",
  "Physics with Electronics",
  "Chemistry",
  "Biology/Microbiology",
  "Mathematics and Statistics",
  "Biochemistry",
];

const POLY_BMS = [
  "Accountancy",
  "Business Administration and Management",
  "Banking and Finance",
  "Marketing",
  "Office Technology and Management",
  "Public Administration",
  "Procurement and Supply Chain Management",
  "Insurance",
];

const POLY_ENV = [
  "Architecture",
  "Estate Management",
  "Quantity Surveying",
  "Urban and Regional Planning",
  "Building Technology",
  "Surveying and Geoinformatics",
  "Environmental Health Technology",
];

const POLY_COMM = [
  "Mass Communication",
  "Office Technology and Management",
  "Computer Science",
  "Information Technology",
  "Printing Technology",
  "Public Relations",
];

const POLY_APP = [
  "Applied Biology",
  "Applied Chemistry",
  "Applied Physics",
  "Science Laboratory Technology",
  "Food Technology",
  "Statistics",
];

const POLY_AGR = [
  "Agricultural Technology",
  "Animal Health and Production Technology",
  "Agricultural and Bio-Environmental Engineering Technology",
  "Fisheries Technology",
  "Horticultural Technology",
];

const POLY_FIN = ["Accountancy", "Banking and Finance", "Taxation", "Financial Studies"];

// ------------------------------- COLLEGES OF EDUCATION -------------------------------

const COE_ARTS_SOC = [
  "English",
  "History",
  "Geography",
  "Economics",
  "Political Science",
  "Social Studies",
  "Fine and Applied Arts",
  "Christian Religious Studies",
  "Islamic Studies",
  "French",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Music",
];

const COE_EDU = [
  "Educational Foundations",
  "Educational Psychology",
  "Guidance and Counselling",
  "Curriculum and Instruction",
  "Educational Administration and Planning",
  "Special Education",
  "Adult and Non-Formal Education",
  "Library and Information Science",
];

const COE_LANG = ["English", "French", "Yoruba", "Igbo", "Hausa", "Arabic", "Linguistics"];

const COE_SCI = [
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "Computer Science Education",
  "Integrated Science",
  "Agricultural Science Education",
  "Home Economics",
];

const COE_VOC = [
  "Business Education",
  "Fine and Applied Arts",
  "Home Economics",
  "Agricultural Science Education",
  "Technical Education",
  "Computer Science Education",
  "Physical and Health Education",
];

const COE_ECCE = [
  "Early Childhood Care and Education",
  "Primary Education Studies",
  "Pre-Primary Education",
];

// ------------------------------- NURSING / HEALTH -------------------------------

const NURS_PROGS = [
  "General Nursing",
  "Midwifery",
  "Community Midwifery",
  "Post Basic Nursing",
  "Community Health Nursing",
  "Psychiatric Nursing",
];

const HLTH_TECH = [
  "Community Health",
  "Environmental Health",
  "Health Information Management",
  "Medical Laboratory Technician",
  "Pharmacy Technician",
  "Dental Therapy",
  "Nutrition and Dietetics",
  "Public Health Nursing",
  "Health Promotion and Education",
];

// ------------------------------------ THE MAP ------------------------------------

export const DEPARTMENTS_BY_FACULTY: Record<string, string[]> = {
  // --- University faculties ---
  "Faculty of Arts": ARTS,
  "Faculty of Arts and Humanities": ARTS,
  "Faculty of Arts and Social Sciences": [...ARTS, ...SOC],
  "Faculty of Arts and Education": [...ARTS, ...EDU],
  "Faculty of Humanities": ARTS,
  "Faculty of Humanities and Social Sciences": [...ARTS, ...SOC],
  "Faculty of Humanities, Social and Management Sciences": [...ARTS, ...SOC, ...MGT],
  "Faculty of Science": SCI,
  "Faculty of Sciences": SCI,
  "Faculty of Science and Education": [...SCI, ...EDU],
  "Faculty of Science and Technology": [...SCI, ...TECH],
  "Faculty of Natural Sciences": SCI,
  "Faculty of Natural and Applied Sciences": SCI,
  "Faculty of Pure and Applied Sciences": SCI,
  "Faculty of Applied Natural Sciences": SCI,
  "Faculty of Basic and Applied Sciences": SCI,
  "Faculty of Biological Sciences": BIO,
  "Faculty of Biosciences": BIO,
  "Faculty of Life Sciences": BIO,
  "Faculty of Physical Sciences": PHYS_SCI,
  "Faculty of Engineering": ENG,
  "Faculty of Engineering and Technology": ENG,
  "Faculty of Engineering and Engineering Technology": ENG,
  "Faculty of Technology": TECH,
  "Faculty of Environmental Technology": ENV,
  "Faculty of Earth and Mineral Sciences": GEOL,
  "Faculty of Law": LAW,
  "Faculty of Social Sciences": SOC,
  "Faculty of Social and Management Sciences": [...SOC, ...MGT],
  "Faculty of Management and Social Sciences": [...MGT, ...SOC],
  "Faculty of Management Sciences": MGT,
  "Faculty of Management Technology": MGMT_TECH,
  "Faculty of Business Administration": MGT,
  "Faculty of Administration": ADMIN,
  "Faculty of Economics and Management Sciences": [...MGT, "Economics"],
  "Faculty of Education": EDU,
  "Faculty of Environmental Sciences": ENV,
  "Faculty of Environmental Studies": ENV,
  "Faculty of Environmental Design": ENV,
  "Faculty of Environmental Design and Management": ENV,
  "Faculty of Agriculture": AGR,
  "Faculty of Agricultural Sciences": AGR,
  "Faculty of Agriculture and Agricultural Technology": AGR,
  "Faculty of Renewable Natural Resources": RNR,
  "Faculty of Food and Consumer Sciences": FOOD,
  "Faculty of Basic Medical Sciences": BMS,
  "Faculty of Clinical Sciences": CLS,
  "Faculty of Medical Sciences": MED,
  "Faculty of Medicine": MED,
  "Faculty of Medicine and Health Sciences": MED,
  "Faculty of Medical and Health Sciences": MED,
  "Faculty of Health Sciences": HLTH,
  "Faculty of Health Sciences and Technology": HLTH,
  "Faculty of Allied Medical Sciences": ALLIED,
  "Faculty of Allied Health Sciences": ALLIED,
  "Faculty of Public Health": PUBHLTH,
  "Faculty of Pharmacy": PHR,
  "Faculty of Pharmaceutical Sciences": PHR,
  "Faculty of Dentistry": DEN,
  "Faculty of Dental Sciences": DEN,
  "Faculty of Veterinary Medicine": VET,
  "Faculty of Computing": COM,
  "Faculty of Information and Communication Technology": COM,
  "Faculty of Communication and Media Studies": CMS,
  "Faculty of Communication and Information Sciences": CMS,
  "Faculty of Nursing Sciences": NURS,
  "Faculty of Transport and Logistics": TRANSPORT,
  "Faculty of Vocational and Technical Education": VET_EDU,
  "Faculty of Military Science and Interdisciplinary Studies": MILITARY,
  "Faculty of Postgraduate Studies": [],

  // --- Technology university "School of ..." variants ---
  "School of Engineering": POLY_ENG,
  "School of Engineering and Engineering Technology": ENG,
  "School of Engineering and Technology": ENG,
  "School of Physical Sciences": PHYS_SCI,
  "School of Life Sciences": BIO,
  "School of Biological Sciences": BIO,
  "School of Agriculture and Agricultural Technology": AGR,
  "School of Environmental Technology": ENV,
  "School of Management Technology": MGMT_TECH,
  "School of Health and Health Technology": HLTH,
  "School of Health Technology": HLTH_TECH,
  "School of Computing": COM,
  "School of Computing and Information Technology": COM,
  "School of Information and Communication Technology": COM,
  "School of Infrastructure, Process Engineering and Technology": ENG,
  "School of Entrepreneurship and Business Innovation": MGT,
  "School of Geosciences and Mineral Engineering": GEOL,
  "School of Earth and Mineral Sciences": GEOL,
  "School of Science": POLY_SCI,
  "School of Sciences": COE_SCI,
  "School of Science and Technology": [...SCI, ...TECH],
  "School of Management": MGT,
  "School of Management and Social Sciences": [...MGT, ...SOC],
  "School of Postgraduate Studies": [],
  "School of Media and Communication": CMS,
  "School of Law": LAW,
  "School of Law and Security Studies": SECURITY_LAW,
  "School of Information Technology and Computing": COM,
  "School of Business and Entrepreneurship": [...MGT, "Entrepreneurship"],
  "School of Arts and Sciences": [...ARTS, ...SCI],
  "School of Computing and Engineering Sciences": [...ENG, ...COM],
  "School of Education and Humanities": [...EDU, ...ARTS],
  "School of Medicine and Health Sciences": MED,
  "School of Nursing": NURS,
  "School of Public and Allied Health": ALLIED,
  "School of Agriculture and Environmental Sciences": [...AGR, ...ENV],

  // --- FUNAAB / MOUAU / JOSTUM "College of ..." variants ---
  "College of Engineering": ENG,
  "College of Engineering and Engineering Technology": ENG,
  "College of Sciences": SCI,
  "College of Science": SCI,
  "College of Science and Technology": [...SCI, ...COM],
  "College of Natural Sciences": SCI,
  "College of Natural and Applied Sciences": SCI,
  "College of Physical Sciences": PHYS_SCI,
  "College of Biological Sciences": BIO,
  "College of Management Sciences": MGT,
  "College of Management and Social Sciences": [...MGT, ...SOC],
  "College of Social and Management Sciences": [...SOC, ...MGT],
  "College of Education": EDU,
  "College of Environmental Sciences": ENV,
  "College of Environmental Technology": ENV,
  "College of Environmental Resources Management": ENV_RES,
  "College of Law": LAW,
  "College of Humanities": ARTS,
  "College of Leadership Development Studies": LEADERSHIP,
  "College of Postgraduate Studies": [],
  "College of Crop and Soil Sciences": CROP_SOIL,
  "College of Plant Science and Crop Production": PLANT_CROP,
  "College of Animal Science and Animal Production": ANIMAL,
  "College of Animal Science and Livestock Production": LIVESTOCK,
  "College of Agricultural Economics, Rural Sociology and Extension": AGRI_ECON,
  "College of Agricultural Management and Rural Development": AGRI_RURAL,
  "College of Agricultural Sciences": AGR,
  "College of Food Science and Human Ecology": FOOD_HUMAN,
  "College of Food Technology and Human Ecology": FOOD_HUMAN,
  "College of Food and Agricultural Resources": FOOD_HUMAN,
  "College of Veterinary Medicine": VET,
  "College of Plant Health": PLANT_HEALTH,
  "College of Medicine and Health Sciences": MED,
  "College of Pharmacy": PHR,
  "College of Computing": COM,
  "College of Business and Social Sciences": [...MGT, ...SOC],
  "College of Human Resources Development": [
    "Human Resources Management",
    "Industrial Relations",
    "Psychology",
    "Guidance and Counselling",
  ],
  "College of Information and Communication Technology": COM,

  // --- Polytechnic schools ---
  "School of Business and Management Studies": POLY_BMS,
  "School of Environmental Studies": POLY_ENV,
  "School of Communication and Information Technology": POLY_COMM,
  "School of Applied Sciences": POLY_APP,
  "School of Agriculture": POLY_AGR,
  "School of Financial Studies": POLY_FIN,

  // --- Colleges of education schools ---
  "School of Arts and Social Sciences": COE_ARTS_SOC,
  "School of Education": COE_EDU,
  "School of Languages": COE_LANG,
  "School of Vocational and Technical Education": COE_VOC,
  "School of Early Childhood Care and Primary Education": COE_ECCE,

  // --- Nursing / other ---
  "School of Nursing Sciences": NURS_PROGS,
  "School of Health Sciences": HLTH_TECH,
  "School of General Studies": [],
};

/** Fallback used for faculty names not present in the map above. */
export const DEFAULT_DEPARTMENTS: string[] = ["General Studies"];
