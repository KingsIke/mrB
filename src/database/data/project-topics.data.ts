// =============================================================================
// Seed data: Project topics per department
// =============================================================================
// Each entry maps a department name (lowercase) to an array of project topic
// suggestions that students in that department can browse and claim.
// =============================================================================

export interface ProjectTopicSeed {
  title: string;
  description: string;
  course?: string;
  courseCode?: string;
  level?: string;
  category?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Computer Science / IT / Software Engineering / Cyber Security / Data Science
// ---------------------------------------------------------------------------

const COMPUTER_SCIENCE: ProjectTopicSeed[] = [
  {
    title: 'Design and Implementation of a Campus Lost-and-Found Web Application',
    description:
      'A web platform where students can report lost items and claim found items, with real-time notifications and image uploads.',
    course: 'Software Engineering',
    courseCode: 'CSC 411',
    level: '400 Level',
    category: 'Web Development',
    tags: ['React', 'Node.js', 'MongoDB'],
  },
  {
    title: 'Smart Attendance System Using Facial Recognition',
    description:
      'An automated attendance system that uses computer vision and deep learning to identify students and mark attendance.',
    course: 'Artificial Intelligence',
    courseCode: 'CSC 419',
    level: '400 Level',
    category: 'Machine Learning / AI',
    tags: ['Python', 'OpenCV', 'Deep Learning'],
  },
  {
    title: 'Real-Time Chat Application with End-to-End Encryption',
    description:
      'A secure messaging platform implementing the Signal Protocol for encrypted 1-on-1 and group chats.',
    course: 'Computer Networks',
    courseCode: 'CSC 312',
    level: '300 Level',
    category: 'Networking & Security',
    tags: ['WebSocket', 'E2E Encryption', 'React Native'],
  },
  {
    title: 'Automated Essay Grading System Using Natural Language Processing',
    description:
      'A system that uses NLP techniques and machine learning to automatically grade student essays against a rubric.',
    course: 'Artificial Intelligence',
    courseCode: 'CSC 419',
    level: '400 Level',
    category: 'Machine Learning / AI',
    tags: ['NLP', 'Python', 'TensorFlow'],
  },
  {
    title: 'Campus Parking Management System with IoT Sensors',
    description:
      'A system that uses ultrasonic sensors and a web dashboard to monitor parking space availability across campus in real time.',
    course: 'Internet of Things',
    courseCode: 'CSC 499',
    level: '400 Level',
    category: 'Embedded Systems',
    tags: ['IoT', 'Arduino', 'Firebase'],
  },
  {
    title: 'E-Library Management System with QR Code Access',
    description:
      'A digital library system where students can search, borrow, and return books using QR code scanning on their mobile devices.',
    course: 'Software Engineering',
    courseCode: 'CSC 411',
    level: '400 Level',
    category: 'Software Engineering',
    tags: ['QR Code', 'Spring Boot', 'MySQL'],
  },
  {
    title: 'Student Performance Prediction Using Machine Learning',
    description:
      'A predictive model that analyzes historical academic data to forecast student performance and identify at-risk students.',
    course: 'Data Science',
    courseCode: 'CSC 490',
    level: '400 Level',
    category: 'Data Science',
    tags: ['Python', 'Scikit-learn', 'Pandas'],
  },
  {
    title: 'Blockchain-Based Certificate Verification System',
    description:
      'A decentralized platform where universities can issue tamper-proof digital certificates that employers can verify.',
    course: 'Blockchain Technology',
    courseCode: 'CSC 499',
    level: '400 Level',
    category: 'Networking & Security',
    tags: ['Blockchain', 'Ethereum', 'Solidity'],
  },
  {
    title: 'Cloud-Native Microservices Architecture for a Hospital Management System',
    description:
      'A hospital management system designed as cloud-native microservices using Docker and Kubernetes for scalability.',
    course: 'Cloud Computing',
    courseCode: 'CSC 480',
    level: '400 Level',
    category: 'Cloud Computing',
    tags: ['Docker', 'Kubernetes', 'AWS'],
  },
  {
    title: 'Music Recommendation Engine Based on Listening History',
    description:
      'A collaborative filtering system that recommends songs based on a user\'s listening patterns and mood analysis.',
    course: 'Data Mining',
    courseCode: 'CSC 434',
    level: '400 Level',
    category: 'Data Science',
    tags: ['Python', 'Collaborative Filtering', 'Spotify API'],
  },
];

// ---------------------------------------------------------------------------
// Mechanical Engineering
// ---------------------------------------------------------------------------

const MECHANICAL_ENGINEERING: ProjectTopicSeed[] = [
  {
    title: 'Design and Fabrication of a Solar-Powered Water Pumping System',
    description:
      'A solar photovoltaic water pumping system designed for rural irrigation, with performance analysis and cost comparison.',
    course: 'Renewable Energy Systems',
    courseCode: 'MEC 415',
    level: '400 Level',
    category: 'Other',
    tags: ['Solar Energy', 'CAD', 'MATLAB'],
  },
  {
    title: 'Computational Fluid Dynamics Analysis of a Car Radiator',
    description:
      'CFD simulation of coolant flow through an automobile radiator to optimize fin geometry and improve heat dissipation.',
    course: 'Fluid Mechanics',
    courseCode: 'MEC 311',
    level: '300 Level',
    category: 'Other',
    tags: ['CFD', 'ANSYS', 'Heat Transfer'],
  },
  {
    title: 'Design of a Low-Cost Robotic Arm for Pick-and-Place Operations',
    description:
      'A 4-DOF robotic arm designed for light industrial pick-and-place tasks, controlled via Arduino and servo motors.',
    course: 'Mechatronics',
    courseCode: 'MEC 421',
    level: '400 Level',
    category: 'Embedded Systems',
    tags: ['Arduino', 'Servo Motors', 'SolidWorks'],
  },
  {
    title: 'Performance Evaluation of a Biodiesel-Powered Diesel Engine',
    description:
      'Experimental study comparing engine performance and emission characteristics when using Jatropha biodiesel blends.',
    course: 'Internal Combustion Engines',
    courseCode: 'MEC 411',
    level: '400 Level',
    category: 'Other',
    tags: ['Biodiesel', 'Engine Testing', 'Emission Analysis'],
  },
  {
    title: 'Thermal Analysis of a Concentrated Solar Power Collector',
    description:
      'Simulation and experimental validation of a parabolic trough solar collector for process heat applications.',
    course: 'Heat and Mass Transfer',
    courseCode: 'MEC 313',
    level: '300 Level',
    category: 'Other',
    tags: ['Solar Thermal', 'MATLAB', 'Thermodynamics'],
  },
];

// ---------------------------------------------------------------------------
// Electrical / Electronic Engineering
// ---------------------------------------------------------------------------

const ELECTRICAL_ENGINEERING: ProjectTopicSeed[] = [
  {
    title: 'Smart Grid Energy Management System Using IoT',
    description:
      'An IoT-based energy monitoring system that tracks electricity consumption in real time and provides automated load balancing.',
    course: 'Power Systems',
    courseCode: 'EEE 413',
    level: '400 Level',
    category: 'Embedded Systems',
    tags: ['IoT', 'Smart Grid', 'Embedded Systems'],
  },
  {
    title: 'Solar Inverter Design with Maximum Power Point Tracking',
    description:
      'A grid-tied solar inverter with MPPT algorithm implementation for optimal energy harvest from photovoltaic panels.',
    course: 'Power Electronics',
    courseCode: 'EEE 311',
    level: '300 Level',
    category: 'Other',
    tags: ['MPPT', 'Inverter Design', 'MATLAB Simulink'],
  },
  {
    title: 'Home Automation System Using Voice Commands',
    description:
      'A voice-controlled home automation system that uses speech recognition to control lights, fans, and appliances.',
    course: 'Microprocessor Systems',
    courseCode: 'EEE 315',
    level: '300 Level',
    category: 'Embedded Systems',
    tags: ['Raspberry Pi', 'Voice Recognition', 'Python'],
  },
  {
    title: 'Design and Simulation of a 5G Antenna for Millimeter Wave Communication',
    description:
      'A compact patch antenna design optimized for 5G millimeter wave frequencies, simulated in CST Microwave Studio.',
    course: 'Antenna Theory',
    courseCode: 'EEE 421',
    level: '400 Level',
    category: 'Networking & Security',
    tags: ['5G', 'CST Simulation', 'Antenna Design'],
  },
];

// ---------------------------------------------------------------------------
// Civil Engineering
// ---------------------------------------------------------------------------

const CIVIL_ENGINEERING: ProjectTopicSeed[] = [
  {
    title: 'Structural Analysis of a Bamboo-Reinforced Concrete Beam',
    description:
      'Experimental and finite element analysis of bamboo as an alternative reinforcement material in reinforced concrete beams.',
    course: 'Structural Analysis',
    courseCode: 'CVE 311',
    level: '300 Level',
    category: 'Other',
    tags: ['FEA', 'AutoCAD', 'Material Testing'],
  },
  {
    title: 'Design of a Rainwater Harvesting System for Campus Buildings',
    description:
      'A sustainable rainwater collection and filtration system designed for integration into existing campus infrastructure.',
    course: 'Environmental Engineering',
    courseCode: 'CVE 415',
    level: '400 Level',
    category: 'Other',
    tags: ['Water Harvesting', 'Sustainability', 'AutoCAD'],
  },
  {
    title: 'Seismic Vulnerability Assessment of Existing Buildings in a Nigerian City',
    description:
      'A rapid visual screening and detailed assessment of building seismic vulnerability in a high-risk zone.',
    course: 'Earthquake Engineering',
    courseCode: 'CVE 421',
    level: '400 Level',
    category: 'Other',
    tags: ['Seismic Analysis', 'Etabs', 'GIS'],
  },
];

// ---------------------------------------------------------------------------
// Business Administration / Management
// ---------------------------------------------------------------------------

const BUSINESS_ADMIN: ProjectTopicSeed[] = [
  {
    title: 'The Impact of Social Media Marketing on SME Revenue Growth in Nigeria',
    description:
      'A survey-based study examining how Instagram and TikTok marketing strategies affect revenue for small businesses.',
    course: 'Marketing Management',
    courseCode: 'BUS 312',
    level: '300 Level',
    category: 'Other',
    tags: ['Social Media', 'SME', 'Survey Research'],
  },
  {
    title: 'Employee Motivation and Organizational Performance in the Banking Sector',
    description:
      'An empirical analysis of how intrinsic and extrinsic motivation factors influence productivity in Nigerian banks.',
    course: 'Organizational Behaviour',
    courseCode: 'BUS 314',
    level: '300 Level',
    category: 'Other',
    tags: ['Employee Motivation', 'Banking', 'Survey'],
  },
  {
    title: 'Digital Payment Adoption and Financial Inclusion Among Nigerian Youth',
    description:
      'A study on the adoption rate of mobile payment platforms and their role in bringing unbanked youth into the financial system.',
    course: 'Banking and Finance',
    courseCode: 'FIN 311',
    level: '300 Level',
    category: 'Other',
    tags: ['FinTech', 'Mobile Payments', 'Financial Inclusion'],
  },
];

// ---------------------------------------------------------------------------
// Mass Communication
// ---------------------------------------------------------------------------

const MASS_COMMUNICATION: ProjectTopicSeed[] = [
  {
    title: 'Fake News Detection on Social Media Using Machine Learning',
    description:
      'A comparative study of ML algorithms for identifying misinformation in Twitter and Facebook posts during elections.',
    course: 'New Media and Society',
    courseCode: 'MCM 314',
    level: '300 Level',
    category: 'Machine Learning / AI',
    tags: ['Fake News', 'NLP', 'Python'],
  },
  {
    title: 'Audience Perception of Podcast News Consumption in Nigerian Universities',
    description:
      'A survey measuring how university students perceive and engage with news podcasts compared to traditional media.',
    course: 'Broadcast Journalism',
    courseCode: 'MCM 411',
    level: '400 Level',
    category: 'Other',
    tags: ['Podcasts', 'Media Consumption', 'Survey'],
  },
];

// ---------------------------------------------------------------------------
// Nursing / Health Sciences
// ---------------------------------------------------------------------------

const NURSING: ProjectTopicSeed[] = [
  {
    title: 'Mobile Application for Medication Reminders and Health Tracking',
    description:
      'A cross-platform mobile app that sends medication reminders to patients and tracks their health vitals over time.',
    course: 'Health Informatics',
    courseCode: 'NSC 412',
    level: '400 Level',
    category: 'Mobile Development',
    tags: ['React Native', 'Healthcare', 'Firebase'],
  },
  {
    title: 'Knowledge, Attitude and Practice of Infection Control Among Nursing Students',
    description:
      'A cross-sectional study assessing infection control awareness and compliance among clinical nursing students.',
    course: 'Community Health Nursing',
    courseCode: 'NSC 311',
    level: '300 Level',
    category: 'Other',
    tags: ['Infection Control', 'Survey', 'Healthcare'],
  },
];

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

const EDUCATION: ProjectTopicSeed[] = [
  {
    title: 'Effectiveness of Gamification in Secondary School Mathematics Learning',
    description:
      'An experimental study comparing academic performance of students taught with gamified apps vs traditional methods.',
    course: 'Educational Technology',
    courseCode: 'EDU 415',
    level: '400 Level',
    category: 'Other',
    tags: ['Gamification', 'E-Learning', 'Mathematics'],
  },
];

// ---------------------------------------------------------------------------
// Law
// ---------------------------------------------------------------------------

const LAW: ProjectTopicSeed[] = [
  {
    title: 'Legal Implications of Artificial Intelligence in Nigerian Criminal Justice',
    description:
      'A doctrinal analysis of how AI-driven tools (facial recognition, predictive policing) intersect with constitutional rights.',
    course: 'Cyber Law and Policy',
    courseCode: 'LAW 419',
    level: '400 Level',
    category: 'Other',
    tags: ['AI Law', 'Nigerian Law', 'Constitutional Law'],
  },
];

// ---------------------------------------------------------------------------
// Agriculture / Food Science
// ---------------------------------------------------------------------------

const AGRICULTURE: ProjectTopicSeed[] = [
  {
    title: 'Precision Agriculture Using Drone-Based Crop Health Monitoring',
    description:
      'Deploying multispectral drone imagery and NDVI analysis to detect crop stress and guide irrigation decisions.',
    course: 'Agricultural Extension',
    courseCode: 'AEC 411',
    level: '400 Level',
    category: 'Other',
    tags: ['Drones', 'NDVI', 'Remote Sensing'],
  },
  {
    title: 'Development of a Solar-Powered Food Dehydrator for Smallholder Farmers',
    description:
      'Design and testing of an affordable solar dryer to reduce post-harvest losses in fruits and vegetables.',
    course: 'Food Science and Technology',
    courseCode: 'FST 311',
    level: '300 Level',
    category: 'Other',
    tags: ['Solar Dryer', 'Food Preservation', 'Prototype'],
  },
];

// ---------------------------------------------------------------------------
// General / Other departments (fallback topics)
// ---------------------------------------------------------------------------

const GENERAL_TOPICS: ProjectTopicSeed[] = [
  {
    title: 'Design and Development of a Campus Event Discovery Platform',
    description:
      'A mobile app that aggregates campus events, allows RSVPs, and sends reminders for academic and social events.',
    course: 'Software Engineering',
    courseCode: 'CSC 411',
    level: '400 Level',
    category: 'Mobile Development',
    tags: ['React Native', 'Firebase', 'Event Management'],
  },
  {
    title: 'Campus Safety Alert System Using GPS and Push Notifications',
    description:
      'A safety app that lets students share their real-time location and send SOS alerts to campus security.',
    course: 'Software Engineering',
    courseCode: 'CSC 411',
    level: '400 Level',
    category: 'Mobile Development',
    tags: ['GPS', 'Push Notifications', 'Safety'],
  },
  {
    title: 'Digital Twin of a University Building for Energy Optimization',
    description:
      'A virtual replica of a campus building that simulates energy usage patterns and suggests efficiency improvements.',
    course: 'IoT and Smart Systems',
    courseCode: 'CSC 499',
    level: '400 Level',
    category: 'Cloud Computing',
    tags: ['Digital Twin', 'IoT', 'Energy Management'],
  },
  {
    title: 'Automated Plagiarism Detection System for Academic Papers',
    description:
      'A tool that uses fingerprinting and NLP techniques to detect plagiarism in submitted academic assignments and theses.',
    course: 'Software Engineering',
    courseCode: 'CSC 411',
    level: '400 Level',
    category: 'Software Engineering',
    tags: ['NLP', 'Python', 'Text Analysis'],
  },
  {
    title: 'Smart Waste Management System for Campus Using IoT Sensors',
    description:
      'IoT bins that monitor fill levels and alert cleaning staff via a dashboard when collection is needed.',
    course: 'Internet of Things',
    courseCode: 'CSC 499',
    level: '400 Level',
    category: 'Embedded Systems',
    tags: ['IoT', 'Firebase', 'Arduino'],
  },
];

// ---------------------------------------------------------------------------
// Department name → topics map
// ---------------------------------------------------------------------------

export const PROJECT_TOPICS_BY_DEPARTMENT: Record<string, ProjectTopicSeed[]> = {
  // Computer Science / IT cluster
  'Computer Science': COMPUTER_SCIENCE,
'Information Technology': COMPUTER_SCIENCE,
  'Cyber Security': COMPUTER_SCIENCE,
  'Software Engineering': COMPUTER_SCIENCE,
  'Data Science': COMPUTER_SCIENCE,
  'Artificial Intelligence': COMPUTER_SCIENCE,
  'Computer and Information Systems': COMPUTER_SCIENCE,
  'Information and Communication Technology': COMPUTER_SCIENCE,

  // Engineering cluster
  'Mechanical Engineering': MECHANICAL_ENGINEERING,
  'Electrical/Electronic Engineering': ELECTRICAL_ENGINEERING,
  'Civil Engineering': CIVIL_ENGINEERING,
  'Computer Engineering': [...COMPUTER_SCIENCE.slice(0, 4), ...MECHANICAL_ENGINEERING.slice(0, 3)],
  'Chemical Engineering': MECHANICAL_ENGINEERING.slice(0, 3),
  'Petroleum Engineering': MECHANICAL_ENGINEERING.slice(0, 3),

  // Business / Management cluster
  'Business Administration': BUSINESS_ADMIN,
  'Accounting': BUSINESS_ADMIN,
  'Banking and Finance': BUSINESS_ADMIN,
  'Marketing': BUSINESS_ADMIN,
  'Entrepreneurship': BUSINESS_ADMIN,
  'Economics': BUSINESS_ADMIN,

  // Mass Communication
  'Mass Communication': MASS_COMMUNICATION,
  'Journalism and Media Studies': MASS_COMMUNICATION,
  'Broadcasting': MASS_COMMUNICATION,
  'Public Relations and Advertising': MASS_COMMUNICATION,

  // Nursing / Health
  'Nursing Science': NURSING,
  'Medical Laboratory Science': NURSING,
  'Physiotherapy': NURSING,
  'Public Health': NURSING,
  'Human Anatomy': NURSING.slice(1),
  'Human Physiology': NURSING.slice(1),

  // Education
  'Educational Management': EDUCATION,
  'Educational Technology': EDUCATION,
  'Guidance and Counselling': EDUCATION,
  'Science Education': EDUCATION,

  // Law
  'Law': LAW,
  'International Law and Jurisprudence': LAW,

  // Agriculture
  'Agricultural Economics': AGRICULTURE,
  'Agronomy': AGRICULTURE,
  'Crop Science': AGRICULTURE,
  'Food Science and Technology': AGRICULTURE,
  'Animal Science': AGRICULTURE,
};

/** Fallback topics when department isn't in the map above */
export const DEFAULT_PROJECT_TOPICS: ProjectTopicSeed[] = GENERAL_TOPICS;
