# scripts/builders/author_round1.py
# Generates 225 diverse QUICK_QUIZ questions
import json
import os

questions = []

def add_q(prompt, options, correct_answer, difficulty, category, subcategory, pattern_type, explanation, time_limit=25):
    assert len(options) == 4, f'Options count must be 4: {prompt}'
    assert len(set(options)) == 4, f'Options must be unique: {prompt}'
    assert correct_answer in options, f'Correct answer must be in options: {prompt}'
    assert difficulty in ['EASY', 'MEDIUM', 'HARD'], f'Invalid difficulty: {difficulty}'
    questions.append({
        'round_type': 'QUICK_QUIZ',
        'prompt': prompt,
        'options': options,
        'correct_answer': correct_answer,
        'difficulty': difficulty,
        'category': category,
        'subcategory': subcategory,
        'pattern_type': pattern_type,
        'time_limit_sec': time_limit,
        'explanation': explanation
    })

# --- PART 1: Science (Physics, Chemistry, Biology, Space) ---
add_q('Which elementary subatomic particle carries a negative fundamental electric charge?',
      ['Proton', 'Neutron', 'Electron', 'Positron'], 'Electron', 'EASY', 'Science', 'Physics', 'Direct Factual Recall',
      'Electrons orbit atomic nuclei and carry a negative charge of -1e.')
add_q('What optical phenomenon causes white light to split into component colors when traversing a glass prism?',
      ['Dispersion', 'Total Internal Reflection', 'Diffraction', 'Polarization'], 'Dispersion', 'MEDIUM', 'Science', 'Optics', 'Concept Identification',
      'Dispersion occurs because refractive index varies with the wavelength of light.')
add_q('Which thermodynamic law states that the entropy of an isolated system never decreases over time?',
      ['Zeroth Law', 'First Law', 'Second Law', 'Third Law'], 'Second Law', 'MEDIUM', 'Science', 'Thermodynamics', 'Direct Factual Recall',
      'The Second Law establishes that natural processes increase the overall entropy of isolated systems.')
add_q('What is the SI derived unit of electrical resistance?',
      ['Volt', 'Ampere', 'Ohm', 'Siemens'], 'Ohm', 'EASY', 'Science', 'Electricity', 'Direct Factual Recall',
      'The Ohm (symbol: Ω) is defined as 1 volt per ampere.')
add_q('Which color of visible light has the shortest wavelength and highest frequency?',
      ['Red', 'Green', 'Blue', 'Violet'], 'Violet', 'EASY', 'Science', 'Optics', 'Comparison',
      'Violet light has a wavelength of approximately 380-450 nm, the shortest in the visible spectrum.')
add_q('What physical principle explains why aeroplanes achieve aerodynamic lift over their curved wings?',
      ['Archimedes Principle', 'Bernoulli Principle', 'Pascal Law', 'Coulomb Law'], 'Bernoulli Principle', 'MEDIUM', 'Science', 'Fluid Dynamics', 'Concept Identification',
      'Bernoulli principle relates higher fluid velocity above the aerofoil with lower pressure relative to the bottom.')
add_q('What is the approximate escape velocity required to leave Earth surface without further propulsion?',
      ['7.9 km/s', '11.2 km/s', '16.7 km/s', '29.8 km/s'], '11.2 km/s', 'HARD', 'Science', 'Astrophysics', 'Precision Value',
      'Earth surface escape velocity is approximately 11.2 km/s (roughly 40,270 km/h).')
add_q('Which fundamental force binds quarks together inside protons and neutrons?',
      ['Gravitational force', 'Weak nuclear force', 'Strong nuclear force', 'Electromagnetic force'], 'Strong nuclear force', 'MEDIUM', 'Science', 'Nuclear Physics', 'Concept Identification',
      'The strong force, mediated by gluons, binds quarks together to form nucleons.')
add_q('At what Celsius temperature does liquid water reach its maximum density at 1 atm?',
      ['0°C', '4°C', '10°C', '100°C'], '4°C', 'EASY', 'Science', 'Physical Chemistry', 'Direct Factual Recall',
      'Pure liquid water has an anomalous density peak at approximately 3.98°C.')
add_q('What type of optical lens is prescribed to correct myopia (nearsightedness)?',
      ['Convex lens', 'Concave lens', 'Cylindrical lens', 'Bifocal prism'], 'Concave lens', 'EASY', 'Science', 'Optics', 'Application',
      'A diverging concave lens spreads incoming rays so the image focuses directly on the retina.')
add_q('In quantum physics, which constant establishes the direct relation E = hf?',
      ['Boltzmann constant', 'Planck constant', 'Avogadro constant', 'Rydberg constant'], 'Planck constant', 'MEDIUM', 'Science', 'Quantum Physics', 'Concept Identification',
      'Max Planck introduced h (≈ 6.626 × 10⁻³⁴ J·s) to relate photon energy with electromagnetic frequency.')
add_q('Which metallic chemical element remains in liquid state at standard ambient temperature (25°C)?',
      ['Gallium', 'Mercury', 'Bromine', 'Cesium'], 'Mercury', 'EASY', 'Science', 'Chemistry', 'Direct Factual Recall',
      'Mercury (Hg) is the only metal that is liquid under standard ambient conditions.')
add_q('What type of radioactive decay emits a helium nucleus consisting of 2 protons and 2 neutrons?',
      ['Alpha decay', 'Beta-minus decay', 'Beta-plus decay', 'Gamma emission'], 'Alpha decay', 'MEDIUM', 'Science', 'Nuclear Physics', 'Concept Identification',
      'An alpha particle is identical to a helium-4 nucleus (2 protons and 2 neutrons).')
add_q('What is the SI derived unit of magnetic flux density?',
      ['Weber', 'Tesla', 'Henry', 'Gauss'], 'Tesla', 'MEDIUM', 'Science', 'Electromagnetism', 'Unit Definition',
      'One Tesla equals one Weber per square meter (Wb/m²).')
add_q('Which phenomenon explains the apparent frequency shift of a wave when the source moves relative to an observer?',
      ['Doppler Effect', 'Compton Effect', 'Photoelectric Effect', 'Cherenkov Radiation'], 'Doppler Effect', 'EASY', 'Science', 'Acoustics', 'Concept Identification',
      'The Doppler effect causes perceived frequency increases when approaching and decreases when receding.')
add_q('Which state of matter consists of a gas of ionized atoms with free electrons at high temperatures?',
      ['Bose-Einstein Condensate', 'Plasma', 'Superfluid', 'Amorphous Solid'], 'Plasma', 'EASY', 'Science', 'Physics', 'Concept Identification',
      'Plasma is the fourth state of matter, common in lightning, stars, and fusion reactors.')
add_q('According to Einstein Special Theory of Relativity, what happens to the relativistic mass of an object as velocity approaches light speed?',
      ['Decreases to zero', 'Remains strictly constant', 'Increases towards infinity', 'Fluctuates periodically'], 'Increases towards infinity', 'HARD', 'Science', 'Relativity', 'Cause and Effect',
      'Relativistic mass approaches infinity as speed approaches c, requiring infinite energy to accelerate further.')
add_q('Which electromagnetic radiation possesses wavelengths immediately shorter than visible violet light?',
      ['Infrared', 'Ultraviolet', 'X-rays', 'Microwaves'], 'Ultraviolet', 'MEDIUM', 'Science', 'Electromagnetism', 'Sequence / Order',
      'Ultraviolet radiation lies between visible violet light and higher-energy X-rays.')
add_q('What property of a fluid measures its internal resistance to flow and shear deformation?',
      ['Surface tension', 'Viscosity', 'Buoyancy', 'Capillarity'], 'Viscosity', 'EASY', 'Science', 'Fluid Dynamics', 'Concept Identification',
      'Viscosity quantifies internal friction between moving fluid layers.')
add_q('In electrical circuits, what does Kirchhoff Current Law (KCL) state regarding a junction node?',
      ['Total voltage across a node is zero', 'Sum of currents entering equals sum leaving', 'Resistance at a node is minimum', 'Power dissipated equals current squared'], 'Sum of currents entering equals sum leaving', 'MEDIUM', 'Science', 'Electrical Circuits', 'Direct Factual Recall',
      'KCL is a direct consequence of the conservation of electric charge at any junction.')
add_q('What is the speed of sound in dry air at 20°C approximately?',
      ['150 m/s', '343 m/s', '767 m/s', '1,500 m/s'], '343 m/s', 'MEDIUM', 'Science', 'Acoustics', 'Precision Value',
      'At 20°C, the speed of sound in dry air is approximately 343 meters per second (1,235 km/h).')
add_q('Which law of planetary motion formulated by Kepler states that planets move in elliptical orbits with the Sun at one focus?',
      ['First Law', 'Second Law', 'Third Law', 'Universal Gravitation Law'], 'First Law', 'MEDIUM', 'Space', 'Orbital Mechanics', 'Direct Factual Recall',
      'Kepler First Law of Planetary Motion states that planetary orbits are ellipses with the Sun at one focus.')
add_q('What astronomical object forms when a massive star core collapses completely past the neutron degeneracy limit?',
      ['White dwarf', 'Neutron star', 'Black hole', 'Brown dwarf'], 'Black hole', 'MEDIUM', 'Space', 'Astrophysics', 'Cause and Effect',
      'When core mass exceeds the Tolman-Oppenheimer-Volkoff limit (approx 2-3 solar masses), complete gravitational collapse produces a black hole.')
add_q('Which device stores electrical energy in an electrostatic field between two conductive plates?',
      ['Inductor', 'Resistor', 'Capacitor', 'Transformer'], 'Capacitor', 'EASY', 'Science', 'Electronics', 'Concept Identification',
      'Capacitors store charge on conductive plates separated by an insulating dielectric material.')
add_q('What is the term for heat transfer occurring through direct molecular collisions without net movement of the material?',
      ['Convection', 'Conduction', 'Radiation', 'Advection'], 'Conduction', 'EASY', 'Science', 'Thermodynamics', 'Concept Identification',
      'Conduction is thermal energy transfer via intermolecular vibrations in solids and stationary fluids.')

# --- Chemistry & Materials (15) ---
add_q('What is the chemical formula of ozone, the atmospheric molecule that absorbs solar ultraviolet radiation?',
      ['O2', 'O3', 'H2O2', 'CO2'], 'O3', 'EASY', 'Science', 'Chemistry', 'Direct Factual Recall',
      'Ozone is a triatomic molecule composed of three oxygen atoms (O3).')
add_q('Which element has the highest electrical conductivity of all metals at room temperature?',
      ['Gold', 'Copper', 'Silver', 'Aluminum'], 'Silver', 'MEDIUM', 'Science', 'Materials Science', 'Comparison',
      'Silver has the highest electrical and thermal conductivity of any known metal.')
add_q('What is the pH value of pure distilled water at 25°C?',
      ['5.5', '7.0', '8.5', '14.0'], '7.0', 'EASY', 'Science', 'Chemistry', 'Direct Factual Recall',
      'At 25°C, pure water has equal concentrations of H+ and OH- ions, yielding a neutral pH of exactly 7.0.')
add_q('Which gas constitutes approximately 78% of Earth troposphere by volume?',
      ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], 'Nitrogen', 'EASY', 'Science', 'Atmospheric Science', 'Direct Factual Recall',
      'Dry air is composed of approximately 78.08% nitrogen, 20.95% oxygen, and 0.93% argon.')
add_q('What allotrope of pure carbon consists of a single layer of carbon atoms arranged in a 2D hexagonal lattice?',
      ['Diamond', 'Graphene', 'Fullerene', 'Lonsdaleite'], 'Graphene', 'MEDIUM', 'Science', 'Materials Science', 'Concept Identification',
      'Graphene is a single atomic monolayer of graphite arranged in a honeycomb sp2-bonded lattice.')
add_q('Which process describes the direct phase transition of a substance from solid to gas without passing through liquid?',
      ['Evaporation', 'Sublimation', 'Deposition', 'Condensation'], 'Sublimation', 'EASY', 'Science', 'Chemistry', 'Concept Identification',
      'Sublimation occurs when solids like dry ice (solid CO2) transition directly into gaseous state.')
add_q('Which acid is naturally secreted by parietal cells in the human stomach to aid digestion?',
      ['Sulfuric acid', 'Hydrochloric acid', 'Nitric acid', 'Acetic acid'], 'Hydrochloric acid', 'EASY', 'Science', 'Biochemistry', 'Direct Factual Recall',
      'Gastric parietal cells secrete hydrochloric acid (HCl) maintaining an acidic gastric pH between 1.5 and 3.5.')
add_q('What is the primary chemical component of natural gas used as household and vehicle fuel?',
      ['Propane', 'Butane', 'Methane', 'Ethane'], 'Methane', 'EASY', 'Science', 'Chemistry', 'Direct Factual Recall',
      'Natural gas is predominantly composed of methane (CH4, typically 70-90%).')
add_q('Which metal is the principal constituent of bronze when alloyed with tin?',
      ['Iron', 'Zinc', 'Copper', 'Lead'], 'Copper', 'EASY', 'Science', 'Materials Science', 'Direct Factual Recall',
      'Bronze is traditionally an alloy composed of copper (typically 88%) and tin (12%).')
add_q('What chemical process converts vegetable oils into solid fats by adding hydrogen across double bonds?',
      ['Esterification', 'Hydrogenation', 'Fermentation', 'Saponification'], 'Hydrogenation', 'MEDIUM', 'Science', 'Organic Chemistry', 'Concept Identification',
      'Catalytic hydrogenation saturates carbon-carbon double bonds, raising melting points.')
add_q('Which element has the lowest atomic weight and is the most abundant chemical substance in the universe?',
      ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], 'Hydrogen', 'EASY', 'Science', 'Chemistry', 'Direct Factual Recall',
      'Hydrogen (H, atomic number 1) accounts for approximately 75% of baryonic mass in the universe.')
add_q('What is the chemical name of common baking soda used in cooking and baking?',
      ['Sodium carbonate', 'Sodium bicarbonate', 'Sodium hydroxide', 'Calcium carbonate'], 'Sodium bicarbonate', 'EASY', 'Science', 'Chemistry', 'Direct Factual Recall',
      'Baking soda is pure sodium bicarbonate (NaHCO3), which releases CO2 gas when reacting with acids.')
add_q('Which chemical bond forms through the electrostatic attraction between oppositely charged ions?',
      ['Covalent bond', 'Ionic bond', 'Metallic bond', 'Hydrogen bond'], 'Ionic bond', 'EASY', 'Science', 'Chemistry', 'Concept Identification',
      'Ionic bonds involve electron transfer from a metal to a nonmetal, forming electrostatic lattice attractions.')
add_q('What is the term for a substance that accelerates a chemical reaction without undergoing permanent chemical change itself?',
      ['Catalyst', 'Reagent', 'Inhibitor', 'Solvent'], 'Catalyst', 'EASY', 'Science', 'Chemistry', 'Concept Identification',
      'A catalyst lowers reaction activation energy without being consumed in the net process.')
add_q('Which radioactive isotope of carbon is universally used in radiocarbon dating of ancient organic materials?',
      ['Carbon-12', 'Carbon-13', 'Carbon-14', 'Carbon-16'], 'Carbon-14', 'MEDIUM', 'Science', 'Nuclear Chemistry', 'Direct Factual Recall',
      'Carbon-14 has a half-life of approximately 5,730 years and decays into nitrogen-14 via beta decay.')

print(f'Count after chemistry: {len(questions)}')

# --- Biology, Genetics & Human Anatomy (25) ---
add_q('Which organelle is universally recognized as the powerhouse of eukaryotic cells due to ATP production?',
      ['Ribosome', 'Golgi apparatus', 'Mitochondria', 'Endoplasmic reticulum'], 'Mitochondria', 'EASY', 'Science', 'Cell Biology', 'Concept Identification',
      'Mitochondria generate cellular adenosine triphosphate (ATP) through oxidative phosphorylation.')
add_q('What nitrogenous base replaces thymine in single-stranded RNA molecules?',
      ['Adenine', 'Cytosine', 'Uracil', 'Guanine'], 'Uracil', 'EASY', 'Science', 'Genetics', 'Direct Factual Recall',
      'In ribonucleic acid (RNA), uracil pairs with adenine where thymine would appear in DNA.')
add_q('Which chamber of the human heart pumps oxygenated blood directly into the aorta?',
      ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'], 'Left ventricle', 'MEDIUM', 'Science', 'Anatomy', 'Concept Identification',
      'The left ventricle features thick muscular walls to pump oxygenated blood under high pressure through systemic circulation.')
add_q('What type of biological macromolecule are enzymes fundamentally composed of?',
      ['Carbohydrates', 'Proteins', 'Lipids', 'Nucleic acids'], 'Proteins', 'EASY', 'Science', 'Biochemistry', 'Concept Identification',
      'Almost all biochemical enzymes are globular proteins folded into precise catalytic conformations.')
add_q('Which hormone secreted by the beta cells of the pancreas regulates blood glucose uptake?',
      ['Glucagon', 'Insulin', 'Cortisol', 'Thyroxine'], 'Insulin', 'EASY', 'Science', 'Physiology', 'Direct Factual Recall',
      'Insulin facilitates cellular absorption of glucose, lowering circulating blood sugar levels.')
add_q('What is the basic functional, structural, and microscopic filtering unit of the human kidney?',
      ['Nephron', 'Neuron', 'Alveolus', 'Hepatocyte'], 'Nephron', 'EASY', 'Science', 'Physiology', 'Concept Identification',
      'Each human kidney contains approximately one million nephrons that filter blood and form urine.')
add_q('Which pigment in plant chloroplasts is primarily responsible for absorbing sunlight during photosynthesis?',
      ['Carotenoid', 'Anthocyanin', 'Chlorophyll', 'Xanthophyll'], 'Chlorophyll', 'EASY', 'Science', 'Botany', 'Direct Factual Recall',
      'Chlorophyll a and b absorb blue and red light while reflecting green light, giving plants their green hue.')
add_q('What blood type is universally designated as the universal red blood cell donor in transfusions?',
      ['A positive', 'AB positive', 'O negative', 'B negative'], 'O negative', 'MEDIUM', 'Science', 'Medicine', 'Direct Factual Recall',
      'O-negative erythrocytes lack A, B, and Rh surface antigens, preventing acute hemolytic transfusion reactions.')
add_q('Which human cranial nerve is primarily responsible for the sensory perception of smell?',
      ['Optic nerve', 'Olfactory nerve', 'Trigeminal nerve', 'Vagus nerve'], 'Olfactory nerve', 'MEDIUM', 'Science', 'Neuroscience', 'Direct Factual Recall',
      'Cranial Nerve I (the olfactory nerve) transmits sensory olfactory data directly from the nasal epithelium to the brain.')
add_q('What is the term for an organism genetic makeup compared to its observable physical characteristics?',
      ['Phenotype', 'Genotype', 'Karyotype', 'Haplotype'], 'Genotype', 'MEDIUM', 'Science', 'Genetics', 'Concept Identification',
      'Genotype refers to the specific allelic genetic composition, while phenotype describes the expressed traits.')
add_q('Which specialized connective tissue connects skeletal muscle directly to bone?',
      ['Ligament', 'Tendon', 'Cartilage', 'Fascia'], 'Tendon', 'EASY', 'Science', 'Anatomy', 'Direct Factual Recall',
      'Tendons connect muscles to bones to transmit force, whereas ligaments connect bone to bone.')
add_q('What is the longest and strongest bone in the human skeleton?',
      ['Tibia', 'Fibula', 'Femur', 'Humerus'], 'Femur', 'EASY', 'Science', 'Anatomy', 'Direct Factual Recall',
      'The femur (thigh bone) supports body weight during standing, running, and jumping.')
add_q('Which vitamin is synthesized photochemically in human skin upon exposure to solar UVB radiation?',
      ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'], 'Vitamin D', 'EASY', 'Science', 'Physiology', 'Direct Factual Recall',
      'UVB converts 7-dehydrocholesterol in the epidermis into pre-vitamin D3, subsequently converted into active calcitriol.')
add_q('What is the medical term for the oxygen-carrying metalloprotein found in human red blood cells?',
      ['Myoglobin', 'Hemoglobin', 'Albumin', 'Ferritin'], 'Hemoglobin', 'EASY', 'Science', 'Hematology', 'Direct Factual Recall',
      'Hemoglobin contains four iron-bearing heme groups that reversibly bind oxygen molecules.')
add_q('Which cellular division process produces four genetically diverse haploid daughter gametes?',
      ['Mitosis', 'Meiosis', 'Binary fission', 'Budding'], 'Meiosis', 'MEDIUM', 'Science', 'Genetics', 'Concept Identification',
      'Meiosis consists of two successive nuclear divisions reducing chromosomal count by half.')
add_q('What disease is caused by a severe deficiency of Vitamin C in human diet?',
      ['Rickets', 'Beri-beri', 'Scurvy', 'Pellagra'], 'Scurvy', 'EASY', 'Science', 'Nutrition', 'Direct Factual Recall',
      'Scurvy impairs collagen synthesis, causing bleeding gums, skin spots, and delayed wound healing.')
add_q('Which organ in the human digestive system produces alkaline bile to emulsify dietary lipids?',
      ['Gallbladder', 'Pancreas', 'Liver', 'Stomach'], 'Liver', 'EASY', 'Science', 'Anatomy', 'Direct Factual Recall',
      'Bile is continuously synthesized by hepatocytes in the liver and stored/concentrated in the gallbladder.')
add_q('What protective membrane encases the human brain and spinal cord in three concentric layers?',
      ['Pleura', 'Pericardium', 'Meninges', 'Peritoneum'], 'Meninges', 'MEDIUM', 'Science', 'Anatomy', 'Concept Identification',
      'The meninges consist of the dura mater, arachnoid mater, and pia mater.')
add_q('Which group of microorganisms lacks a true membrane-bound nucleus and organelles?',
      ['Eukaryotes', 'Prokaryotes', 'Fungi', 'Protozoa'], 'Prokaryotes', 'EASY', 'Science', 'Microbiology', 'Concept Identification',
      'Prokaryotes (bacteria and archaea) have uncompartmentalized genetic material lacking a nuclear envelope.')
add_q('What is the term for the symbiotic biological relationship where both participating species derive mutual benefit?',
      ['Commensalism', 'Mutualism', 'Parasitism', 'Amensalism'], 'Mutualism', 'EASY', 'Science', 'Ecology', 'Concept Identification',
      'Mutualism is an ecological interaction where both species increase their fitness (e.g., bees and flowering plants).')
add_q('What part of the human eye adjusts its curvature to focus light from varying distances onto the retina?',
      ['Cornea', 'Crystalline lens', 'Iris', 'Pupil'], 'Crystalline lens', 'MEDIUM', 'Science', 'Anatomy', 'Concept Identification',
      'Ciliary muscles contract or relax to alter lens curvature during optical accommodation.')
add_q('Which endocrine gland located at the base of the brain is often referred to as the master gland?',
      ['Thyroid gland', 'Adrenal gland', 'Pituitary gland', 'Pineal gland'], 'Pituitary gland', 'EASY', 'Science', 'Endocrinology', 'Direct Factual Recall',
      'The pituitary gland secretes tropic hormones that control thyroid, adrenals, and gonads.')
add_q('Which human blood cells are primarily tasked with phagocytosis and immune defense against pathogens?',
      ['Erythrocytes', 'Thrombocytes', 'Leukocytes', 'Reticulocytes'], 'Leukocytes', 'EASY', 'Science', 'Immunology', 'Direct Factual Recall',
      'Leukocytes (white blood cells) identify, engulf, and destroy invading foreign microbes.')
add_q('What is the genetic condition where an organism has three copies of chromosome 21 instead of two?',
      ['Turner Syndrome', 'Down Syndrome', 'Klinefelter Syndrome', 'Edwards Syndrome'], 'Down Syndrome', 'EASY', 'Science', 'Genetics', 'Direct Factual Recall',
      'Trisomy 21 is known clinically as Down Syndrome.')
add_q('What specialized cell-cell junction enables rapid electrical impulse transmission in cardiac muscle tissue?',
      ['Tight junctions', 'Gap junctions', 'Desmosomes', 'Hemidesmosomes'], 'Gap junctions', 'HARD', 'Science', 'Physiology', 'Concept Identification',
      'Intercalated discs contain gap junctions that allow direct ionic current flow between adjacent cardiomyocytes.')

print(f'Count after biology: {len(questions)}')

# --- Space & Astronomy (15) ---
add_q('Which planet in our solar system has the most prominent and extensive planetary ring system visible from Earth?',
      ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], 'Saturn', 'EASY', 'Space', 'Planetary Science', 'Direct Factual Recall',
      'Saturn has the most extensive planetary ring system composed primarily of water ice and rock particulates.')
add_q('What is the name of the nearest major spiral galaxy to our Milky Way galaxy?',
      ['Andromeda Galaxy', 'Triangulum Galaxy', 'Sombrero Galaxy', 'Whirlpool Galaxy'], 'Andromeda Galaxy', 'EASY', 'Space', 'Astronomy', 'Direct Factual Recall',
      'The Andromeda Galaxy (M31) is a barred spiral galaxy approximately 2.5 million light-years from Earth.')
add_q('Which celestial body in our solar system possesses the highest volcanic activity and hundreds of active sulfur volcanoes?',
      ['Europa', 'Io', 'Titan', 'Enceladus'], 'Io', 'MEDIUM', 'Space', 'Planetary Science', 'Concept Identification',
      'Jupiter moon Io is the most volcanically active body in the solar system due to tidal gravitational friction.')
add_q('What is the theoretical boundary region marking the outer gravitational edge of our solar system where comets originate?',
      ['Kuiper Belt', 'Asteroid Belt', 'Oort Cloud', 'Heliosheath'], 'Oort Cloud', 'MEDIUM', 'Space', 'Astronomy', 'Concept Identification',
      'The Oort cloud is a theoretical spherical cloud of icy planetesimals surrounding the solar system out to 100,000 AU.')
add_q('Which NASA space telescope launched in December 2021 observes the universe primarily in infrared wavelengths from the Sun-Earth L2 Lagrange point?',
      ['Hubble Space Telescope', 'James Webb Space Telescope', 'Spitzer Space Telescope', 'Kepler Space Telescope'], 'James Webb Space Telescope', 'EASY', 'Space', 'Space Exploration', 'Direct Factual Recall',
      'JWST operates at the Sun-Earth L2 point, utilizing a 6.5-meter beryllium mirror for high-resolution deep infrared imaging.')
add_q('What is the astronomical term for a lunar phase when the Moon passes directly between Earth and the Sun, obscuring the solar disk?',
      ['Lunar Eclipse', 'Solar Eclipse', 'Transit of Venus', 'Equinox'], 'Solar Eclipse', 'EASY', 'Space', 'Astronomy', 'Concept Identification',
      'A solar eclipse occurs when the Moon occults the Sun, casting a shadow upon Earth.')
add_q('Which planet possesses the longest rotation period, taking approximately 243 Earth days to rotate once and spinning in a retrograde direction?',
      ['Mercury', 'Venus', 'Mars', 'Uranus'], 'Venus', 'MEDIUM', 'Space', 'Planetary Science', 'Comparison',
      'Venus rotates clockwise (retrograde) once every 243 Earth days, longer than its orbital period of 225 Earth days.')
add_q('What type of stellar remnant is formed when a low-to-intermediate mass star (like our Sun) sheds its outer layers at the end of its life?',
      ['Neutron star', 'White dwarf', 'Black hole', 'Pulsar'], 'White dwarf', 'MEDIUM', 'Space', 'Astrophysics', 'Cause and Effect',
      'Stars with initial masses under roughly 8 solar masses end their lifecycle as degenerate carbon-oxygen white dwarfs.')
add_q('Which mission executed humanity first successful crewed lunar landing in July 1969?',
      ['Apollo 8', 'Apollo 11', 'Apollo 13', 'Gemini 4'], 'Apollo 11', 'EASY', 'Space', 'Space Exploration', 'Direct Factual Recall',
      'Apollo 11 landed Neil Armstrong and Buzz Aldrin on the Sea of Tranquility on July 20, 1969.')
add_q('What is the term for the explosion that marks the violent energetic collapse and death of a massive star?',
      ['Protostar', 'Nova', 'Supernova', 'Gamma Ray Burst'], 'Supernova', 'EASY', 'Space', 'Astrophysics', 'Concept Identification',
      'A Type II supernova occurs when core iron synthesis triggers rapid gravitational collapse and catastrophic explosion.')
add_q('What unit of distance in astronomy is defined as the distance at which 1 astronomical unit subtends an angle of one arcsecond?',
      ['Light-year', 'Parsec', 'Astronomical Unit', 'Hubble Length'], 'Parsec', 'MEDIUM', 'Space', 'Astronomy', 'Unit Definition',
      'One parsec (parallax arcsecond) equals approximately 3.26 light-years or 3.086 × 10¹³ kilometers.')
add_q('Which moon of Saturn is known for possessing a dense nitrogen-rich atmosphere and liquid methane-ethane lakes?',
      ['Titan', 'Enceladus', 'Mimas', 'Dione'], 'Titan', 'MEDIUM', 'Space', 'Planetary Science', 'Direct Factual Recall',
      'Titan is the only known moon with a substantial dense atmosphere and stable surface bodies of liquid hydrocarbons.')
add_q('Which dwarf planet located in the asteroid belt between Mars and Jupiter is the largest object in the main belt?',
      ['Pluto', 'Ceres', 'Eris', 'Haumea'], 'Ceres', 'MEDIUM', 'Space', 'Planetary Science', 'Direct Factual Recall',
      'Ceres constitutes roughly one-third of the total mass of the asteroid belt and is classified as a dwarf planet.')
add_q('What is the name of the supermassive black hole located at the dynamical center of the Milky Way galaxy?',
      ['Cygnus X-1', 'Sagittarius A*', 'M87*', 'Centaurus A'], 'Sagittarius A*', 'MEDIUM', 'Space', 'Astrophysics', 'Direct Factual Recall',
      'Sagittarius A* is a compact astronomical radio source with a mass roughly 4.15 million times that of our Sun.')
add_q('Which planet has an extreme axial tilt of approximately 98 degrees, effectively rotating on its side?',
      ['Saturn', 'Uranus', 'Neptune', 'Mars'], 'Uranus', 'MEDIUM', 'Space', 'Planetary Science', 'Direct Factual Recall',
      'Uranus has an axial tilt of 97.77°, giving it extreme 42-year long seasonal daylight and darkness cycles.')

# --- World Geography & Earth Sciences (25) ---
add_q('Which is the longest river in the world by continuous channel length?',
      ['Amazon River', 'Nile River', 'Yangtze River', 'Mississippi River'], 'Nile River', 'EASY', 'Geography', 'World Geography', 'Comparison',
      'The Nile River flows approximately 6,650 km through northeastern Africa, traditionally recognized as the longest river.')
add_q('What is the deepest oceanic trench in the world, descending over 10,900 meters below sea level?',
      ['Java Trench', 'Puerto Rico Trench', 'Mariana Trench', 'Tonga Trench'], 'Mariana Trench', 'EASY', 'Geography', 'Physical Geography', 'Comparison',
      'The Challenger Deep within the Mariana Trench in the western Pacific is Earth deepest known marine point.')
add_q('Which is the largest hot desert on Earth by surface area, covering roughly 9 million square kilometers across North Africa?',
      ['Gobi Desert', 'Kalahari Desert', 'Sahara Desert', 'Arabian Desert'], 'Sahara Desert', 'EASY', 'Geography', 'World Geography', 'Comparison',
      'The Sahara is the largest non-polar hot desert on Earth, spanning from the Atlantic Ocean to the Red Sea.')
add_q('Which narrow maritime strait separates the Iberian Peninsula of Europe from Morocco in North Africa?',
      ['Strait of Malacca', 'Strait of Gibraltar', 'Bering Strait', 'Bosphorus Strait'], 'Strait of Gibraltar', 'EASY', 'Geography', 'Straits', 'Direct Factual Recall',
      'The Strait of Gibraltar connects the Atlantic Ocean to the Mediterranean Sea and is only 13 km wide at its narrowest point.')
add_q('Which mountain range forms the traditional natural continental divide separating Europe from Asia?',
      ['Alps', 'Ural Mountains', 'Caucasus Mountains', 'Carpathians'], 'Ural Mountains', 'MEDIUM', 'Geography', 'World Geography', 'Concept Identification',
      'The Ural Mountains run north-south through western Russia, delineating the conventional European-Asian border.')
add_q('What is the capital city of Canada?',
      ['Toronto', 'Vancouver', 'Montreal', 'Ottawa'], 'Ottawa', 'EASY', 'Geography', 'Political Geography', 'Direct Factual Recall',
      'Ottawa in Ontario was selected as the capital of Canada by Queen Victoria in 1857.')
add_q('Which landlocked European nation is bordered by Germany, France, Italy, Austria, and Liechtenstein?',
      ['Switzerland', 'Belgium', 'Luxembourg', 'Slovakia'], 'Switzerland', 'EASY', 'Geography', 'World Geography', 'Direct Factual Recall',
      'Switzerland is a landlocked alpine country surrounded by those five central European nations.')
add_q('Which continent contains the largest number of sovereign sovereign countries (54 recognized nations)?',
      ['Asia', 'Africa', 'Europe', 'South America'], 'Africa', 'MEDIUM', 'Geography', 'World Geography', 'Comparison',
      'Africa consists of 54 fully recognized independent sovereign states.')
add_q('Which artificial waterway opened in 1869 connects the Mediterranean Sea directly to the Red Sea?',
      ['Panama Canal', 'Suez Canal', 'Kiel Canal', 'Erie Canal'], 'Suez Canal', 'EASY', 'Geography', 'Canals & Maritime', 'Direct Factual Recall',
      'The Suez Canal enables direct maritime transit between Europe and Asia without navigating around the African continent.')
add_q('What is the capital city of Australia?',
      ['Sydney', 'Melbourne', 'Brisbane', 'Canberra'], 'Canberra', 'EASY', 'Geography', 'Political Geography', 'Direct Factual Recall',
      'Canberra was purpose-built as Australia federal capital as a compromise between rival cities Sydney and Melbourne.')
add_q('Which South American country has the longest north-to-south coastline along the Pacific Ocean?',
      ['Peru', 'Chile', 'Argentina', 'Colombia'], 'Chile', 'EASY', 'Geography', 'World Geography', 'Comparison',
      'Chile extends over 4,300 km from north to south while averaging only 177 km in east-west width.')
add_q('What is the highest uninterrupted single-drop waterfall in the world, located in Canaima National Park, Venezuela?',
      ['Niagara Falls', 'Victoria Falls', 'Angel Falls', 'Iguazu Falls'], 'Angel Falls', 'MEDIUM', 'Geography', 'Physical Geography', 'Direct Factual Recall',
      'Angel Falls (Kerepakupai Meru) has a total height of 979 meters and an uninterrupted plunge of 807 meters.')
add_q('Which body of water is the world largest inland lake by surface area (roughly 371,000 km²)?',
      ['Lake Superior', 'Caspian Sea', 'Lake Victoria', 'Lake Baikal'], 'Caspian Sea', 'MEDIUM', 'Geography', 'World Geography', 'Comparison',
      'The Caspian Sea is an endorheic basin considered the largest inland lake/sea on Earth by surface area.')
add_q('What is the deepest freshwater lake in the world, containing over 20% of Earth unfrozen surface fresh water?',
      ['Lake Baikal', 'Lake Tanganyika', 'Lake Superior', 'Lake Michigan'], 'Lake Baikal', 'MEDIUM', 'Geography', 'Physical Geography', 'Comparison',
      'Lake Baikal in southern Siberia reaches an extraordinary maximum depth of 1,642 meters.')
add_q('Which strait connects the Black Sea directly to the Sea of Marmara, dividing Istanbul into European and Asian halves?',
      ['Dardanelles', 'Bosphorus', 'Strait of Hormuz', 'Bab-el-Mandeb'], 'Bosphorus', 'MEDIUM', 'Geography', 'Straits', 'Direct Factual Recall',
      'The Bosphorus is an internationally significant strait dividing European Thrace from Asian Anatolia.')
add_q('What major tectonic plate boundary runs along the Pacific Ocean basin, causing roughly 90% of the world earthquakes?',
      ['Mid-Atlantic Ridge', 'Pacific Ring of Fire', 'San Andreas Fault', 'Alpine-Himalayan belt'], 'Pacific Ring of Fire', 'EASY', 'Geography', 'Geology', 'Concept Identification',
      'The Pacific Ring of Fire is a horseshoe-shaped basin characterized by active subduction zones, volcanoes, and earthquakes.')
add_q('Which African lake is the primary source reservoir of the White Nile river?',
      ['Lake Chad', 'Lake Tanganyika', 'Lake Victoria', 'Lake Malawi'], 'Lake Victoria', 'MEDIUM', 'Geography', 'World Geography', 'Direct Factual Recall',
      'Lake Victoria, shared by Uganda, Kenya, and Tanzania, is the chief reservoir source for the White Nile.')
add_q('Which island is the world largest island by surface area that is not an independent continent?',
      ['Madagascar', 'Greenland', 'Borneo', 'New Guinea'], 'Greenland', 'EASY', 'Geography', 'World Geography', 'Comparison',
      'Greenland covers roughly 2.16 million km², making it the largest island on Earth.')
add_q('In which mountain range is the highest peak outside Asia, Mount Aconcagua (6,961 meters), situated?',
      ['Rockies', 'Alps', 'Andes', 'Caucasus'], 'Andes', 'MEDIUM', 'Geography', 'Physical Geography', 'Direct Factual Recall',
      'Aconcagua in western Argentina is the highest peak in both the Western and Southern Hemispheres.')
add_q('Which country contains the largest number of natural freshwater lakes in the world?',
      ['United States', 'Russia', 'Canada', 'Finland'], 'Canada', 'MEDIUM', 'Geography', 'Physical Geography', 'Comparison',
      'Canada contains over 60% of the world natural lakes, with an estimated 2 million lakes spanning its territory.')
add_q('What is the name of the atmospheric circulation cell situated between the equator and roughly 30 degrees latitude north and south?',
      ['Ferrel cell', 'Hadley cell', 'Polar cell', 'Walker circulation'], 'Hadley cell', 'HARD', 'Geography', 'Climatology', 'Concept Identification',
      'The Hadley cell involves tropical air rising at the ITCZ, flowing poleward, and descending in the subtropical high-pressure belt.')
add_q('Which European capital city is crossed by the river Danube alongside Vienna, Bratislava, and Belgrade?',
      ['Prague', 'Budapest', 'Warsaw', 'Bucharest'], 'Budapest', 'MEDIUM', 'Geography', 'World Geography', 'Direct Factual Recall',
      'Budapest, Hungary, is split into historic Buda and Pest across the banks of the Danube River.')
add_q('Which African nation was historically known as Abyssinia and was one of the few African countries never colonized by European powers?',
      ['Ghana', 'Nigeria', 'Ethiopia', 'Kenya'], 'Ethiopia', 'MEDIUM', 'Geography', 'World Geography', 'Direct Factual Recall',
      'Ethiopia defeated Italian colonial forces at the Battle of Adwa in 1896, preserving its sovereignty.')
add_q('What is the southernmost active volcano on planet Earth, located on Ross Island in Antarctica?',
      ['Mount Erebus', 'Mount Vesuvius', 'Kilauea', 'Mount Etna'], 'Mount Erebus', 'HARD', 'Geography', 'Physical Geography', 'Direct Factual Recall',
      'Mount Erebus in Antarctica is the southernmost continuously active volcano on Earth, known for its persistent phonolitic lava lake.')
add_q('Which nation controls the maritime chokepoint Strait of Malacca alongside Malaysia and Indonesia?',
      ['Thailand', 'Singapore', 'Philippines', 'Brunei'], 'Singapore', 'EASY', 'Geography', 'Straits', 'Direct Factual Recall',
      'Singapore lies at the southern entrance of the Strait of Malacca, one of the world busiest trade corridors.')

# --- Indian Geography & National Heritage (25) ---
add_q('Which Indian river is known as the Tsangpo in its upper course through Tibet before entering Arunachal Pradesh?',
      ['Ganga', 'Indus', 'Brahmaputra', 'Yamuna'], 'Brahmaputra', 'EASY', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'The Brahmaputra originates as the Yarlung Tsangpo in southwestern Tibet and cuts through the Himalayas into India.')
add_q('What is the highest mountain peak located entirely within the territory of India?',
      ['K2 (Godwin Austen)', 'Kangchenjunga', 'Nanda Devi', 'Kamet'], 'Nanda Devi', 'HARD', 'Geography', 'Indian Geography', 'Comparison',
      'While Kangchenjunga lies on the Sikkim-Nepal border, Nanda Devi (7,816 m) in Uttarakhand is the highest peak completely within India.')
add_q('Which state in India has the longest maritime coastline?',
      ['Maharashtra', 'Tamil Nadu', 'Gujarat', 'Andhra Pradesh'], 'Gujarat', 'EASY', 'Geography', 'Indian Geography', 'Comparison',
      'Gujarat has the longest mainland coastline in India, extending approximately 1,600 kilometers.')
add_q('What is the southern point of the Indian Union mainland located in Tamil Nadu?',
      ['Indira Point', 'Kanyakumari (Cape Comorin)', 'Rameswaram', 'Dhanushkodi'], 'Kanyakumari (Cape Comorin)', 'EASY', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'Kanyakumari is the southernmost tip of the Indian mainland peninsula, while Indira Point in Nicobar is the southern tip of Indian territory.')
add_q('Which plateau is the oldest and largest geological physiographic division of India?',
      ['Chota Nagpur Plateau', 'Malwa Plateau', 'Deccan Plateau', 'Shillong Plateau'], 'Deccan Plateau', 'MEDIUM', 'Geography', 'Indian Geography', 'Concept Identification',
      'The Deccan Plateau is an ancient triangular peninsular plateau composed of ancient Precambrian shields and volcanic basalt traps.')
add_q('Which Indian river flows westward through a rift valley between the Vindhya and Satpura mountain ranges?',
      ['Godavari', 'Narmada', 'Krishna', 'Mahanadi'], 'Narmada', 'MEDIUM', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'The Narmada flows westward through a tectonic rift valley between the Vindhya and Satpura ranges into the Arabian Sea.')
add_q('Which national park in Assam is renowned as the primary habitat of the endangered Great Indian One-horned Rhinoceros?',
      ['Jim Corbett National Park', 'Kaziranga National Park', 'Ranthambore National Park', 'Sundarbans National Park'], 'Kaziranga National Park', 'EASY', 'Environment', 'Indian Heritage', 'Direct Factual Recall',
      'Kaziranga National Park in Assam holds two-thirds of the world population of one-horned rhinoceroses.')
add_q('What is the name of the high-altitude pass connecting Ladakh with Tibet, historically part of the ancient Silk Route?',
      ['Rohtang Pass', 'Nathu La', 'Zoji La', 'Karakoram Pass'], 'Karakoram Pass', 'MEDIUM', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'Karakoram Pass lies at an elevation of 5,540 meters between Ladakh and the Xinjiang region of China.')
add_q('Which state in India is widely known as the Spice Garden of India due to its extensive production of pepper and cardamom?',
      ['Kerala', 'Karnataka', 'Tamil Nadu', 'Andhra Pradesh'], 'Kerala', 'EASY', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'Kerala has traded spices for over 3,000 years with ancient Sumerians, Phoenicians, Greeks, and Romans.')
add_q('Which lake in Odisha is the largest coastal brackish water lagoon in India and second largest in the world?',
      ['Vembanad Lake', 'Chilika Lake', 'Pulicat Lake', 'Kolleru Lake'], 'Chilika Lake', 'MEDIUM', 'Geography', 'Indian Geography', 'Comparison',
      'Chilika Lake is a vast coastal lagoon covering up to 1,165 km² designated as a Ramsar Wetland of International Importance.')
add_q('Which mountain pass connects Srinagar to Leh across the Great Himalayan Range in Jammu & Kashmir / Ladakh?',
      ['Banihal Pass', 'Zoji La', 'Shipki La', 'Jelep La'], 'Zoji La', 'MEDIUM', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'Zoji La is a strategic mountain pass on National Highway 1 connecting the Kashmir Valley with the Ladakh plateau.')
add_q('Which is the largest freshwater lake in India, located in the Bandipora district of Jammu and Kashmir?',
      ['Dal Lake', 'Wular Lake', 'Loktak Lake', 'Nainital Lake'], 'Wular Lake', 'MEDIUM', 'Geography', 'Indian Geography', 'Comparison',
      'Wular Lake is one of the largest freshwater lakes in Asia, formed by tectonic activity and fed by the Jhelum River.')
add_q('Which Indian river is affectionately revered as the Dakshin Ganga (Ganges of the South)?',
      ['Krishna', 'Cauvery', 'Godavari', 'Tapti'], 'Godavari', 'MEDIUM', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'The Godavari is India second longest river (1,465 km) and is widely referred to as Dakshin Ganga.')
add_q('What is the capital city of the northeastern Indian state of Meghalaya, nicknamed the Scotland of the East?',
      ['Agartala', 'Imphal', 'Shillong', 'Aizawl'], 'Shillong', 'EASY', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'Shillong, the capital of Meghalaya, was historically dubbed Scotland of the East due to its rolling pine hills.')
add_q('Which river delta formed by the Ganga and Brahmaputra rivers is the largest river delta in the world?',
      ['Mekong Delta', 'Sundarbans Delta', 'Mississippi Delta', 'Nile Delta'], 'Sundarbans Delta', 'EASY', 'Geography', 'Indian Geography', 'Comparison',
      'The Sundarbans Delta spans roughly 100,000 km² and contains the world largest continuous mangrove forest.')
add_q('Which city in India is universally known as the Diamond City because it cuts and polishes roughly 90% of the world diamonds?',
      ['Jaipur', 'Surat', 'Mumbai', 'Hyderabad'], 'Surat', 'EASY', 'Business', 'Indian Economy', 'Direct Factual Recall',
      'Surat in Gujarat is the world primary diamond cutting and polishing center.')
add_q('What imaginary geographic coordinate line passes almost directly through the center of eight Indian states?',
      ['Equator', 'Tropic of Cancer', 'Tropic of Capricorn', 'Prime Meridian'], 'Tropic of Cancer', 'EASY', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'The Tropic of Cancer (23.5° N) traverses Gujarat, Rajasthan, MP, Chhattisgarh, Jharkhand, West Bengal, Tripura, and Mizoram.')
add_q('Which island territory of India contains Barren Island, the only confirmed active volcano in South Asia?',
      ['Lakshadweep', 'Andaman and Nicobar Islands', 'Daman and Diu', 'Majuli'], 'Andaman and Nicobar Islands', 'MEDIUM', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'Barren Island in the Andaman Sea is the only active volcano along the chain from Sumatra to Myanmar.')
add_q('Which waterfall in Karnataka formed by the Sharavathi river is one of the highest plunge waterfalls in India?',
      ['Dudhsagar Falls', 'Jog Falls (Gersoppa)', 'Athirappilly Falls', 'Hogenakkal Falls'], 'Jog Falls (Gersoppa)', 'MEDIUM', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'Jog Falls drops 253 meters in a sheer plunge across four distinct cascades: Raja, Roarer, Rocket, and Rani.')
add_q('What is the standard time meridian for Indian Standard Time (IST), located near Mirzapur in Uttar Pradesh?',
      ['80° E', '82.5° E', '85° E', '90° E'], '82.5° E', 'EASY', 'Geography', 'Indian Geography', 'Precision Value',
      'Indian Standard Time is calculated based on the 82.5° E longitude meridian, which is UTC +5:30.')
add_q('Which desert in northwestern India forms the world ninth-largest subtropical desert by area?',
      ['Rann of Kutch', 'Thar Desert (Great Indian Desert)', 'Ladakh Cold Desert', 'Spiti Desert'], 'Thar Desert (Great Indian Desert)', 'EASY', 'Geography', 'Indian Geography', 'Direct Factual Recall',
      'The Thar Desert spans across Rajasthan, Gujarat, Punjab, and Sindh, covering approximately 200,000 km².')
add_q('Which river is the longest tributary river in India, flowing parallel to the Ganga before merging at Prayagraj?',
      ['Yamuna', 'Ghaghara', 'Kosi', 'Son'], 'Yamuna', 'EASY', 'Geography', 'Indian Geography', 'Comparison',
      'The Yamuna originates at the Yamunotri glacier and flows 1,376 km before its sacred confluence (Triveni Sangam) with the Ganga.')
add_q('What is the largest river island in the world situated in the Brahmaputra river in Assam?',
      ['Elephanta Island', 'Majuli Island', 'Srirangam Island', 'St Mary Island'], 'Majuli Island', 'EASY', 'Geography', 'Indian Geography', 'Comparison',
      'Majuli is the first island district of India and recognized by Guinness World Records as the largest inhabited river island.')
add_q('Which national park in Madhya Pradesh is famous for high Bengal tiger density and inspired Rudyard Kipling The Jungle Book?',
      ['Kanha National Park', 'Bandhavgarh National Park', 'Pench National Park', 'Panna National Park'], 'Pench National Park', 'MEDIUM', 'Environment', 'Indian Heritage', 'Direct Factual Recall',
      'The Seoni and Pench forest landscape provided the authentic setting for Mowgli story in Kipling Jungle Book.')
add_q('Which mountain range acts as a barrier preventing cold Siberian winds from entering the Indian subcontinent?',
      ['Western Ghats', 'Aravalli Range', 'Himalayas', 'Satpura Range'], 'Himalayas', 'EASY', 'Geography', 'Indian Geography', 'Cause and Effect',
      'The massive Himalayan barrier blocks freezing Arctic air masses from Central Asia, ensuring India warm monsoon-dominated climate.')

print(f'Count after geography: {len(questions)}')

# --- World History & Civilizations (20) ---
add_q('Which ancient civilization developed cuneiform, widely regarded as the earliest documented writing system?',
      ['Ancient Egypt', 'Sumerian Civilization', 'Indus Valley Civilization', 'Minoan Civilization'], 'Sumerian Civilization', 'MEDIUM', 'History', 'World History', 'Direct Factual Recall',
      'Cuneiform script was developed by the Sumerians of ancient Mesopotamia around 3400-3200 BCE using wedge-shaped reed styli.')
add_q('In which year did the French Revolution officially begin with the storming of the Bastille prison in Paris?',
      ['1776', '1789', '1799', '1804'], '1789', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'The storming of the Bastille fortress on July 14, 1789, ignited the French Revolution against absolute monarchy.')
add_q('Who was the Macedonian king who created one of the largest ancient empires stretching from Greece to northwestern India by age 30?',
      ['Philip II', 'Alexander the Great', 'Julius Caesar', 'Cyrus the Great'], 'Alexander the Great', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'Alexander III of Macedon undefeatedly campaigned across Asia Minor, Egypt, Persia, and Punjab before dying in Babylon in 323 BCE.')
add_q('What decisive 1815 battle marked the final military defeat of French Emperor Napoleon Bonaparte?',
      ['Battle of Austerlitz', 'Battle of Waterloo', 'Battle of Leipzig', 'Battle of Trafalgar'], 'Battle of Waterloo', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'The Duke of Wellington allied forces and Gebhard von Blücher Prussian army defeated Napoleon at Waterloo in Belgium.')
add_q('Which global conflict was formally concluded by the signing of the Treaty of Versailles in June 1919?',
      ['American Civil War', 'World War I', 'Franco-Prussian War', 'World War II'], 'World War I', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'The Treaty of Versailles signed in the Hall of Mirrors assigned war guilt to Germany and concluded the First World War.')
add_q('Which empire built the ancient Andean mountain citadel of Machu Picchu in Peru during the 15th century?',
      ['Maya Empire', 'Aztec Empire', 'Inca Empire', 'Olmec Civilization'], 'Inca Empire', 'EASY', 'History', 'World History', 'Concept Identification',
      'Machu Picchu was constructed around 1450 CE under the reign of Inca emperor Pachacuti on a high mountain ridge.')
add_q('Who wrote the fundamental 1776 economic treatise The Wealth of Nations, articulating the concept of the invisible hand?',
      ['John Maynard Keynes', 'Adam Smith', 'David Ricardo', 'Karl Marx'], 'Adam Smith', 'EASY', 'Business', 'Economic History', 'Direct Factual Recall',
      'Scottish philosopher Adam Smith established classical economics with An Inquiry into the Nature and Causes of the Wealth of Nations.')
add_q('What wall built in 1961 stood as the physical symbol of the Cold War division between Western democracy and Eastern communism until 1989?',
      ['Hadrian Wall', 'Great Wall of China', 'Berlin Wall', 'Maginot Line'], 'Berlin Wall', 'EASY', 'History', 'Cold War', 'Concept Identification',
      'The Berlin Wall encircled West Berlin for 28 years until peaceful protests brought about its fall on November 9, 1989.')
add_q('Which famous naval engagement fought off the coast of Spain in 1805 saw British Admiral Horatio Nelson defeat the combined French and Spanish fleets?',
      ['Battle of Midway', 'Battle of Trafalgar', 'Battle of Jutland', 'Battle of Lepanto'], 'Battle of Trafalgar', 'MEDIUM', 'History', 'World History', 'Direct Factual Recall',
      'Nelson victory confirmed British maritime supremacy for over a century, although he was fatally wounded aboard HMS Victory.')
add_q('What Italian intellectual movement of the 14th to 17th centuries marked the bridge between the Middle Ages and modern era?',
      ['Enlightenment', 'Renaissance', 'Reformation', 'Romanticism'], 'Renaissance', 'EASY', 'History', 'World History', 'Concept Identification',
      'The Renaissance originated in Florence, reviving classical philosophy, scientific inquiry, art, and humanism.')
add_q('Who was the principal leader of the Bolshevik party that seized power during the 1917 Russian October Revolution?',
      ['Joseph Stalin', 'Vladimir Lenin', 'Leon Trotsky', 'Nikita Khrushchev'], 'Vladimir Lenin', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'Vladimir Lenin led the Bolshevik overthrow of the Russian Provisional Government, establishing the Soviet state.')
add_q('Which charter agreed to by King John of England at Runnymede in 1215 established the fundamental principle that even the monarch is subject to the law?',
      ['Habeas Corpus Act', 'Magna Carta', 'Bill of Rights', 'Petition of Right'], 'Magna Carta', 'EASY', 'History', 'World History', 'Concept Identification',
      'The Magna Carta (Great Charter) placed statutory limits on monarchical power and influenced modern constitutional law.')
add_q('Which ancient civilization constructed the monumental Pyramids of Giza during its Old Kingdom period?',
      ['Mesopotamia', 'Ancient Egypt', 'Phoenicia', 'Persia'], 'Ancient Egypt', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'Fourth Dynasty pharaohs Khufu, Khafre, and Menkaure commissioned the Giza pyramid complex along the Nile.')
add_q('What was the military alliance formed in 1955 between the Soviet Union and seven Eastern European satellite states in response to NATO?',
      ['League of Nations', 'Warsaw Pact', 'Comintern', 'Comecon'], 'Warsaw Pact', 'MEDIUM', 'History', 'Cold War', 'Direct Factual Recall',
      'The Warsaw Treaty Organization established mutual defense among the USSR, Poland, East Germany, and allies during the Cold War.')
add_q('Which German goldsmith invented movable metal type printing in Europe around 1440, revolutionizing information dissemination?',
      ['Johannes Gutenberg', 'Martin Luther', 'Albrecht Dürer', 'Desiderius Erasmus'], 'Johannes Gutenberg', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'Gutenberg printing press with hand-cast metal type made mass book publishing economically viable.')
add_q('What ancient city-state was famous for its rigorous military training discipline (Agoge) and heroic stand at the Battle of Thermopylae?',
      ['Athens', 'Sparta', 'Thebes', 'Corinth'], 'Sparta', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'Spartan King Leonidas led 300 Spartans and Greek allies against Xerxes Persian invasion at Thermopylae in 480 BCE.')
add_q('Which major European power was unified as an Empire in 1871 largely through the diplomacy of Chancellor Otto von Bismarck?',
      ['Italy', 'Germany', 'Austria-Hungary', 'Ottoman Empire'], 'Germany', 'MEDIUM', 'History', 'World History', 'Direct Factual Recall',
      'Bismarck engineered the unification of German states under Prussian leadership following the Franco-Prussian War.')
add_q('What code of ancient Babylonian laws promulgated around 1750 BCE is famous for establishing the eye for an eye principle of justice?',
      ['Justinian Code', 'Code of Hammurabi', 'Twelve Tables', 'Draco Laws'], 'Code of Hammurabi', 'EASY', 'History', 'World History', 'Concept Identification',
      'King Hammurabi had 282 edicts carved on a basalt stele regulating commerce, property rights, and criminal penalties.')
add_q('Who was the Roman general who was appointed dictator in perpetuo before being assassinated on the Ides of March in 44 BCE?',
      ['Mark Antony', 'Julius Caesar', 'Augustus', 'Nero'], 'Julius Caesar', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'Julius Caesar assassination by Roman senators led to the collapse of the Roman Republic and birth of the Roman Empire.')
add_q('What multinational peace organization was established in October 1945 in San Francisco following the end of World War II?',
      ['League of Nations', 'United Nations', 'NATO', 'European Coal and Steel Community'], 'United Nations', 'EASY', 'History', 'World History', 'Direct Factual Recall',
      'The UN Charter was ratified by 51 original member states to prevent future global military cataclysms.')

# --- Indian History & Freedom Movement (20) ---
add_q('Which Mauryan Emperor renounced military conquest and embraced Buddhism following the devastating Kalinga War in 261 BCE?',
      ['Chandragupta Maurya', 'Bindusara', 'Ashoka the Great', 'Brihadratha'], 'Ashoka the Great', 'EASY', 'History', 'Indian History', 'Cause and Effect',
      'Emperor Ashoka embraced Buddhist Ahimsa (non-violence) and carved edicts across rock pillars throughout the subcontinent.')
add_q('In which year did the Great Rebellion (also known as the First War of Indian Independence) break out, sparked by the revolt at Meerut?',
      ['1757', '1857', '1905', '1942'], '1857', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'The 1857 uprising led to the dissolution of the British East India Company and direct rule by the British Crown.')
add_q('Who was the primary architect and Chairman of the Drafting Committee of the Constitution of India?',
      ['Jawaharlal Nehru', 'Dr. B. R. Ambedkar', 'Sardar Vallabhbhai Patel', 'Dr. Rajendra Prasad'], 'Dr. B. R. Ambedkar', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Dr. Bhimrao Ramji Ambedkar served as the chief drafter of India sovereign, democratic constitution.')
add_q('Which decisive 1757 battle established British East India Company territorial rule in Bengal under Robert Clive?',
      ['Battle of Buxar', 'Battle of Plassey', 'Battle of Panipat', 'Battle of Wandiwash'], 'Battle of Plassey', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Clive defeated Nawab Siraj-ud-Daulah at Plassey through political intrigue with commander Mir Jafar.')
add_q('Who led the historic 24-day, 388-kilometer Salt March from Sabarmati Ashram to Dandi in 1930 to protest the British salt monopoly?',
      ['Subhas Chandra Bose', 'Mahatma Gandhi', 'Bhagat Singh', 'Bal Gangadhar Tilak'], 'Mahatma Gandhi', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Mahatma Gandhi initiated the Civil Disobedience Movement by breaking the salt law at coastal Dandi on April 6, 1930.')
add_q('Which Mughal emperor founded the city of Fatehpur Sikri and promulgated the syncretic spiritual movement Din-i Ilahi?',
      ['Babur', 'Humayun', 'Akbar', 'Shah Jahan'], 'Akbar', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Jalal-ud-din Muhammad Akbar pursued broad religious tolerance, administrative centralization, and patronage of the arts.')
add_q('Which ancient university in modern-day Bihar was a premier international center of Buddhist learning from the 5th to 12th century CE?',
      ['Taxila', 'Nalanda', 'Vikramashila', 'Vallabhi'], 'Nalanda', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Nalanda University attracted thousands of scholars from China, Korea, Japan, and Tibet before its destruction in 1193 CE.')
add_q('Who gave the immortal slogan Give me blood, and I shall give you freedom! while leading the Indian National Army (Azad Hind Fauj)?',
      ['Bhagat Singh', 'Chandrashekhar Azad', 'Subhas Chandra Bose', 'Lala Lajpat Rai'], 'Subhas Chandra Bose', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Netaji Subhas Chandra Bose mobilized the Azad Hind Fauj in Southeast Asia to fight for India complete independence.')
add_q('Which Indian ruler of the Kingdom of Mysore was known as the Tiger of Mysore and pioneered military iron-cased rocketry?',
      ['Hyder Ali', 'Tipu Sultan', 'Shivaji Maharaj', 'Krishnadevaraya'], 'Tipu Sultan', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Tipu Sultan utilized Mysorean iron rockets against British forces during the Anglo-Mysore Wars.')
add_q('In which city did British troops under Brigadier General Reginald Dyer perpetrate the Jallianwala Bagh massacre on Baisakhi in April 1919?',
      ['Lahore', 'Amritsar', 'Delhi', 'Jalandhar'], 'Amritsar', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'General Dyer ordered troops to fire upon thousands of peaceful unarmed demonstrators gathered at Jallianwala Bagh in Amritsar.')
add_q('Who was the founder of the Maratha Empire, crowned as Chhatrapati at Raigad Fort in 1674?',
      ['Sambhajiraje', 'Shivaji Maharaj', 'Bajirao I', 'Madhavrao'], 'Shivaji Maharaj', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Chhatrapati Shivaji Maharaj established a sovereign Maratha realm utilizing progressive civil administration and guerrilla warfare (Ganimi Kava).')
add_q('Which ancient Indian kingdom ruler Krishnadevaraya presided over the golden age of the Vijayanagara Empire from Hampi?',
      ['Hoysala Dynasty', 'Tuluva Dynasty', 'Chalukya Dynasty', 'Rashtrakuta Dynasty'], 'Tuluva Dynasty', 'MEDIUM', 'History', 'Indian History', 'Direct Factual Recall',
      'Krishnadevaraya of the Tuluva Dynasty expanded the Vijayanagara Empire and patronized Telugu and Sanskrit literature.')
add_q('What movement was launched by Mahatma Gandhi at the Gowalia Tank Maidan in Bombay on August 8, 1942, with the slogan Do or Die?',
      ['Non-Cooperation Movement', 'Civil Disobedience Movement', 'Quit India Movement', 'Swadeshi Movement'], 'Quit India Movement', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'The Quit India Resolution demanded an orderly British withdrawal from India during World War II.')
add_q('Who was known as the Iron Man of India for successfully integrating over 560 princely states into the Indian Union?',
      ['Jawaharlal Nehru', 'Sardar Vallabhbhai Patel', 'Maulana Abul Kalam Azad', 'C. Rajagopalachari'], 'Sardar Vallabhbhai Patel', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'As Deputy Prime Minister and Home Minister, Sardar Patel unified the political fabric of independent India.')
add_q('Which Gupta dynasty king earned the title Kaviraja and is depicted playing the veena on his ancient gold coinage?',
      ['Chandragupta I', 'Samudragupta', 'Chandragupta II (Vikramaditya)', 'Kumaragupta'], 'Samudragupta', 'MEDIUM', 'History', 'Indian History', 'Direct Factual Recall',
      'Samudragupta was celebrated for his military conquests and artistic accomplishments, immortalized on the Allahabad Pillar inscription.')
add_q('In which year did the British transfer the capital of the British Indian Empire from Calcutta to Delhi?',
      ['1905', '1911', '1919', '1931'], '1911', 'MEDIUM', 'History', 'Indian History', 'Direct Factual Recall',
      'King George V announced the capital relocation from Calcutta to Delhi at the Delhi Durbar in December 1911.')
add_q('Which freedom fighter founded the revolutionary organisation Hindustan Socialist Republican Association (HSRA) alongside Chandrashekhar Azad?',
      ['Bhagat Singh', 'Subhas Chandra Bose', 'Vinayak Savarkar', 'Aurobindo Ghosh'], 'Bhagat Singh', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Bhagat Singh transformed the HRA into the HSRA in 1928 at Feroz Shah Kotla, advocating socialism and independence.')
add_q('Which social reformer founded the Brahmo Samaj in Calcutta in 1828 and campaigned vigorously against the practice of Sati?',
      ['Swami Vivekananda', 'Ishwar Chandra Vidyasagar', 'Raja Ram Mohan Roy', 'Dayananda Saraswati'], 'Raja Ram Mohan Roy', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Raja Ram Mohan Roy is considered the Father of the Indian Renaissance for his advocacy of modern education and social reform.')
add_q('Who served as the first female Prime Minister of India, in office from 1966 to 1977 and again from 1980 to 1984?',
      ['Sarojini Naidu', 'Indira Gandhi', 'Sucheta Kripalani', 'Vijayalakshmi Pandit'], 'Indira Gandhi', 'EASY', 'History', 'Indian History', 'Direct Factual Recall',
      'Indira Gandhi was India third Prime Minister and the world second democratically elected female prime minister.')
add_q('Which Indus Valley Civilization archaeological site located in Gujarat features a tidal dockyard engineered for maritime trade?',
      ['Mohenjo-daro', 'Harappa', 'Lothal', 'Kalibangan'], 'Lothal', 'MEDIUM', 'History', 'Indian History', 'Concept Identification',
      'Lothal had a massive brick basin connected to an old course of the Sabarmati river, functioning as a world-class bronze-age dock.')

# --- Computers, OS & Networking (20) ---
add_q('What layer of the standard 7-layer OSI networking model is responsible for logical IP routing and packet forwarding?',
      ['Data Link Layer', 'Network Layer', 'Transport Layer', 'Session Layer'], 'Network Layer', 'MEDIUM', 'Computers', 'Networking', 'Concept Identification',
      'Layer 3 (Network Layer) handles packet encapsulation, logical addressing (IPv4/IPv6), and routing across networks.')
add_q('Which protocol operates at the Transport Layer to provide connection-oriented, reliable, and ordered data byte-stream delivery?',
      ['UDP', 'TCP', 'ICMP', 'IGMP'], 'TCP', 'EASY', 'Computers', 'Networking', 'Direct Factual Recall',
      'Transmission Control Protocol (TCP) ensures reliable delivery through three-way handshakes, sequence numbers, and ACKs.')
add_q('What is the standard default port number used for secure encrypted HTTPS web traffic?',
      ['80', '443', '8080', '22'], '443', 'EASY', 'Computers', 'Networking', 'Direct Factual Recall',
      'HTTPS uses port 443 by default with TLS/SSL encryption, whereas plain HTTP uses port 80.')
add_q('Which fundamental memory architecture features a shared bus and single storage space for both instructions and program data?',
      ['Harvard architecture', 'Von Neumann architecture', 'Modified Harvard', 'Turing architecture'], 'Von Neumann architecture', 'MEDIUM', 'Computers', 'Architecture', 'Concept Identification',
      'Von Neumann architecture uses a unified memory for code and data, which can result in the Von Neumann bottleneck.')
add_q('In Linux and Unix-like operating systems, which shell command is used to alter file and directory read/write/execute permissions?',
      ['chown', 'chmod', 'chgrp', 'passwd'], 'chmod', 'EASY', 'Computers', 'Operating Systems', 'Direct Factual Recall',
      'The chmod (change mode) command modifies standard octal or symbolic POSIX file permission bits.')
add_q('What data structure operates on a strict Last-In, First-Out (LIFO) order of element insertion and removal?',
      ['Queue', 'Stack', 'Linked list', 'Binary heap'], 'Stack', 'EASY', 'Computers', 'Data Structures', 'Concept Identification',
      'Stacks push and pop elements from the top, adhering strictly to Last-In, First-Out semantics.')
add_q('Which HTTP response status code series indicates a client-side error, such as a bad request or unauthorized access?',
      ['2xx', '3xx', '4xx', '5xx'], '4xx', 'EASY', 'Computers', 'Web Standards', 'Concept Identification',
      'HTTP 4xx status codes (e.g. 400 Bad Request, 401 Unauthorized, 404 Not Found) denote client errors.')
add_q('What is the maximum number of unique IPv4 addresses theoretically possible under standard 32-bit addressing?',
      ['65,536', '16.7 million', 'Approximately 4.29 billion', '340 undecillion'], 'Approximately 4.29 billion', 'MEDIUM', 'Computers', 'Networking', 'Precision Value',
      '2³² yields exactly 4,294,967,296 unique IPv4 addresses, leading to the transition towards 128-bit IPv6.')
add_q('Which computer bus standard designed in the 1990s replaced legacy serial and parallel ports for peripheral connections?',
      ['SCSI', 'PCI', 'USB', 'FireWire'], 'USB', 'EASY', 'Computers', 'Hardware', 'Direct Factual Recall',
      'Universal Serial Bus (USB) standardized connectors and power delivery for keyboards, mice, and storage devices.')
add_q('In relational database design, what normal form requires that all non-key attributes are fully functionally dependent on the primary key (no partial dependencies)?',
      ['First Normal Form (1NF)', 'Second Normal Form (2NF)', 'Third Normal Form (3NF)', 'Boyce-Codd Normal Form (BCNF)'], 'Second Normal Form (2NF)', 'HARD', 'Computers', 'Databases', 'Concept Identification',
      '2NF requires being in 1NF and ensuring all non-candidate-key attributes depend on the complete primary key.')
add_q('Which central processing unit component is responsible for executing arithmetic operations and boolean logic evaluations?',
      ['Control Unit (CU)', 'Arithmetic Logic Unit (ALU)', 'Instruction Register', 'Program Counter'], 'Arithmetic Logic Unit (ALU)', 'EASY', 'Computers', 'Hardware', 'Concept Identification',
      'The ALU processes binary arithmetic (add, subtract) and bitwise logical operations (AND, OR, NOT).')
add_q('What type of operating system scheduler preemptively switches CPU execution between threads at rapid time slices?',
      ['Batch scheduler', 'Round Robin scheduler', 'First-Come, First-Served', 'Shortest Job First'], 'Round Robin scheduler', 'MEDIUM', 'Computers', 'Operating Systems', 'Concept Identification',
      'Round Robin assigns fixed time quantum slices per process in circular order, ensuring responsive multitasking.')
add_q('What is the term for volatile high-speed semiconductor storage located directly on the CPU die between registers and main RAM?',
      ['Flash memory', 'Cache memory (L1/L2/L3)', 'Virtual memory', 'ROM'], 'Cache memory (L1/L2/L3)', 'EASY', 'Computers', 'Hardware', 'Concept Identification',
      'SRAM cache memory stores frequently referenced instructions and data to minimize high-latency DRAM bus roundtrips.')
add_q('Which internet protocol resolves human-friendly domain names (like google.com) into numerical machine IP addresses?',
      ['DHCP', 'DNS', 'SNMP', 'ARP'], 'DNS', 'EASY', 'Computers', 'Networking', 'Direct Factual Recall',
      'Domain Name System (DNS) operates as the decentralized hierarchical naming directory of the Internet.')
add_q('In Git version control, which command combines changes from an external branch into the currently active branch?',
      ['git fetch', 'git merge', 'git push', 'git branch'], 'git merge', 'EASY', 'Computers', 'Software Engineering', 'Direct Factual Recall',
      'git merge integrates commit histories from a target branch into the current working branch.')
add_q('What asymptotic time complexity does binary search achieve when querying a sorted array of N elements?',
      ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'], 'O(log N)', 'EASY', 'Computers', 'Algorithms', 'Concept Identification',
      'Binary search halves the remaining search interval on each step, yielding logarithmic O(log N) time performance.')
add_q('Which communication protocol is utilized by network devices to automatically assign dynamic IP configurations to client machines?',
      ['DHCP', 'DNS', 'NTP', 'SMTP'], 'DHCP', 'EASY', 'Computers', 'Networking', 'Direct Factual Recall',
      'Dynamic Host Configuration Protocol (DHCP) automatically provides subnet masks, gateway addresses, and IP assignments.')
add_q('What is the term for a software vulnerability where a program writes data beyond the allocated boundary of a fixed-size memory buffer?',
      ['SQL Injection', 'Cross-Site Scripting (XSS)', 'Buffer Overflow', 'Race Condition'], 'Buffer Overflow', 'MEDIUM', 'Computers', 'Cybersecurity', 'Concept Identification',
      'Buffer overflows overwrite adjacent memory stacks, allowing malicious code injection or arbitrary instruction execution.')
add_q('Which Linux command is used to display live, dynamic system process metrics, CPU utilization, and memory usage?',
      ['ps', 'top', 'df', 'free'], 'top', 'EASY', 'Computers', 'Operating Systems', 'Direct Factual Recall',
      'top displays real-time interactive process list sorted by CPU or memory consumption.')
add_q('What is the primary architectural purpose of a Database Index (such as a B-Tree or Hash Index)?',
      ['Ensure data encryption on disk', 'Accelerate data retrieval query speeds', 'Compress database storage footprint', 'Enforce user role access control'], 'Accelerate data retrieval query speeds', 'EASY', 'Computers', 'Databases', 'Concept Identification',
      'Indexes provide fast sorted lookups avoiding full sequential table scans on disk.')

print(f'Count after history and computers: {len(questions)}')

# --- Cybersecurity & Internet (15) ---
add_q('Which asymmetric cryptographic algorithm published in 1977 by Rivest, Shamir, and Adleman relies on the difficulty of prime factorization?',
      ['AES', 'DES', 'RSA', 'Diffie-Hellman'], 'RSA', 'MEDIUM', 'Computers', 'Cryptography', 'Concept Identification',
      'RSA uses pairs of public and private keys derived from products of two large prime numbers.')
add_q('What form of cyber attack deceives users into divulging confidential credentials by masquerading as a trustworthy entity?',
      ['DDoS', 'Phishing', 'Man-in-the-Middle', 'Ransomware'], 'Phishing', 'EASY', 'Computers', 'Cybersecurity', 'Concept Identification',
      'Phishing utilizes fraudulent emails, fake login portals, or messages to trick users into revealing passwords or credit card data.')
add_q('What symmetric block cipher standard adopted by NIST in 2001 operates on 128-bit blocks with key lengths of 128, 192, or 256 bits?',
      ['AES (Advanced Encryption Standard)', 'Triple DES', 'Blowfish', 'RC4'], 'AES (Advanced Encryption Standard)', 'MEDIUM', 'Computers', 'Cryptography', 'Direct Factual Recall',
      'AES (Rijndael cipher) replaced DES as the federal standard for classified and commercial electronic data encryption.')
add_q('What type of network attack floods a server with distributed traffic from hundreds or thousands of compromised botnet nodes?',
      ['SQL Injection', 'Cross-Site Scripting (XSS)', 'DDoS (Distributed Denial of Service)', 'Zero-Day Exploit'], 'DDoS (Distributed Denial of Service)', 'EASY', 'Computers', 'Cybersecurity', 'Concept Identification',
      'A DDoS attack exhausts server bandwidth, sockets, or CPU resources, rendering websites unavailable to legitimate users.')
add_q('In public key infrastructure (PKI), which trusted entity issues and digitally signs cryptographic SSL/TLS certificates?',
      ['Root Domain Registrar', 'Certificate Authority (CA)', 'Internet Service Provider', 'IANA'], 'Certificate Authority (CA)', 'MEDIUM', 'Computers', 'Cybersecurity', 'Direct Factual Recall',
      'Certificate Authorities verify domain ownership and sign digital certificates that browsers trust.')
add_q('What is the term for malicious software that encrypts victim files and demands extortion payment for decryption keys?',
      ['Spyware', 'Adware', 'Ransomware', 'Keylogger'], 'Ransomware', 'EASY', 'Computers', 'Cybersecurity', 'Concept Identification',
      'Ransomware locks victim data using asymmetric encryption until cryptocurrency ransom is paid.')
add_q('What security mechanism requires users to authenticate identity using two distinct verification factors?',
      ['Single Sign-On (SSO)', 'Two-Factor Authentication (2FA)', 'OAuth 2.0', 'CAPTCHA'], 'Two-Factor Authentication (2FA)', 'EASY', 'Computers', 'Cybersecurity', 'Concept Identification',
      '2FA combines something you know (password) with something you have (authenticator app / SMS token) or are (biometric).')
add_q('Which HTTP header attribute prevents JavaScript from accessing session cookies, mitigating cross-site scripting cookie theft?',
      ['Secure', 'HttpOnly', 'SameSite', 'Path'], 'HttpOnly', 'MEDIUM', 'Computers', 'Web Security', 'Direct Factual Recall',
      'The HttpOnly flag blocks client-side scripts from reading document.cookie, preserving session tokens from XSS.')
add_q('What security protocol secures web traffic between browser and server by establishing an encrypted session tunnel?',
      ['FTP', 'TLS (Transport Layer Security)', 'Telnet', 'SNMP'], 'TLS (Transport Layer Security)', 'EASY', 'Computers', 'Web Security', 'Direct Factual Recall',
      'TLS (superseding deprecated SSL) encrypts web data in transit, ensuring confidentiality and integrity.')
add_q('What type of software vulnerability is actively exploited in the wild before the software developer has issued a patch?',
      ['Trojan horse', 'Zero-Day Vulnerability', 'Brute force flaw', 'Dictionary flaw'], 'Zero-Day Vulnerability', 'MEDIUM', 'Computers', 'Cybersecurity', 'Concept Identification',
      'A Zero-Day vulnerability represents an unpatched security hole that developers have had zero days to fix.')
add_q('What mechanism allows client applications to access user resources hosted on third-party servers without exposing user passwords?',
      ['SAML', 'OAuth 2.0', 'Kerberos', 'RADIUS'], 'OAuth 2.0', 'MEDIUM', 'Computers', 'Web Standards', 'Concept Identification',
      'OAuth 2.0 issues scoped access tokens allowing authorization delegation (e.g. Sign in with Google).')
add_q('What is the function of a network firewall?',
      ['Accelerate internet bandwidth speed', 'Filter and inspect inbound and outbound traffic according to security rules', 'Assign dynamic IP addresses', 'Host domain DNS records'], 'Filter and inspect inbound and outbound traffic according to security rules', 'EASY', 'Computers', 'Cybersecurity', 'Concept Identification',
      'Firewalls inspect packet headers and states to block unauthorized network intrusions.')
add_q('Which hashing algorithm family designed by NSA is currently standard for digital certificates and git commits (e.g. SHA-256)?',
      ['MD5', 'SHA-2', 'CRC32', 'Blowfish'], 'SHA-2', 'MEDIUM', 'Computers', 'Cryptography', 'Direct Factual Recall',
      'SHA-256 produces a fixed 256-bit cryptographic hash digest with high collision resistance.')
add_q('What type of social engineering attack specifically targets high-profile corporate executives or government officials?',
      ['Phishing', 'Spear Phishing', 'Whaling', 'Smishing'], 'Whaling', 'MEDIUM', 'Computers', 'Cybersecurity', 'Concept Identification',
      'Whaling is spear-phishing specifically customized to target C-suite executives for financial wire fraud or espionage.')
add_q('What web security header instructs browsers to strictly communicate with a server exclusively via HTTPS?',
      ['Content-Security-Policy', 'HSTS (HTTP Strict Transport Security)', 'X-Frame-Options', 'Access-Control-Allow-Origin'], 'HSTS (HTTP Strict Transport Security)', 'HARD', 'Computers', 'Web Security', 'Direct Factual Recall',
      'HSTS forces browsers to automatically upgrade HTTP links to HTTPS and refuse invalid SSL certificate overrides.')

# --- Economics, Business & Finance (25) ---
add_q('What economic indicator measures the total monetary value of all finished goods and services produced within a country borders in a year?',
      ['Gross National Product (GNP)', 'Gross Domestic Product (GDP)', 'Net National Income', 'Consumer Price Index (CPI)'], 'Gross Domestic Product (GDP)', 'EASY', 'Business', 'Economics', 'Concept Identification',
      'GDP reflects the economic size and output generated within a nation geographical territory.')
add_q('What central banking term refers to the persistent, broad-based rise in the overall price level of goods and services over time?',
      ['Deflation', 'Stagflation', 'Inflation', 'Depreciation'], 'Inflation', 'EASY', 'Business', 'Economics', 'Concept Identification',
      'Inflation erodes purchasing power, meaning each unit of currency buys fewer goods and services.')
add_q('Which institution operates as the central bank and monetary regulatory authority of India, established in April 1935?',
      ['State Bank of India (SBI)', 'Reserve Bank of India (RBI)', 'Securities and Exchange Board of India (SEBI)', 'NABARD'], 'Reserve Bank of India (RBI)', 'EASY', 'Business', 'Banking', 'Direct Factual Recall',
      'The RBI controls the issuance and supply of the Indian Rupee and formulates national monetary policy.')
add_q('What instant real-time payment system developed by the National Payments Corporation of India (NPCI) facilitates inter-bank peer-to-peer mobile transactions?',
      ['RTGS', 'NEFT', 'IMPS', 'UPI (Unified Payments Interface)'], 'UPI (Unified Payments Interface)', 'EASY', 'Business', 'Fintech', 'Direct Factual Recall',
      'UPI powers instant round-the-clock mobile payments across thousands of commercial banks and fintech applications in India.')
add_q('What is the financial term for an investment vehicle funded by shareholders that trades diversified portfolios of stocks and bonds?',
      ['Treasury bill', 'Mutual Fund', 'Hedge derivative', 'Commercial paper'], 'Mutual Fund', 'EASY', 'Business', 'Finance', 'Concept Identification',
      'Mutual funds pool capital from multiple retail and institutional investors to purchase diversified security portfolios.')
add_q('What financial metric calculates the total market value of a publicly traded company outstanding equity shares?',
      ['Book Value', 'Enterprise Value', 'Market Capitalization', 'Price-to-Earnings Ratio'], 'Market Capitalization', 'MEDIUM', 'Business', 'Finance', 'Concept Identification',
      'Market capitalization equals current share price multiplied by the total number of outstanding shares.')
add_q('What economic market structure exists when a single seller completely dominates the supply of a commodity without close substitutes?',
      ['Oligopoly', 'Monopoly', 'Monopolistic Competition', 'Perfect Competition'], 'Monopoly', 'EASY', 'Business', 'Economics', 'Concept Identification',
      'A monopoly possesses significant pricing power due to high barriers to market entry for competitors.')
add_q('In finance, what does the rule of 72 approximately estimate?',
      ['Years required for an investment to double at a fixed interest rate', 'Annual stock market volatility percentage', 'Credit score risk probability', 'Optimal bond maturity duration'], 'Years required for an investment to double at a fixed interest rate', 'MEDIUM', 'Business', 'Finance', 'Application',
      'Dividing 72 by the annual percentage rate of return yields an approximation of the doubling period.')
add_q('Which regulatory body regulates securities and capital markets in India, safeguarding investor interests?',
      ['RBI', 'SEBI', 'IRDAI', 'PFRDA'], 'SEBI', 'EASY', 'Business', 'Regulation', 'Direct Factual Recall',
      'The Securities and Exchange Board of India (SEBI) oversees stock exchanges, brokers, and listed companies.')
add_q('What is the term for interest earned not only on the initial principal but also on previously accumulated interest?',
      ['Simple interest', 'Compound interest', 'Nominal interest', 'Discount interest'], 'Compound interest', 'EASY', 'Business', 'Finance', 'Concept Identification',
      'Compound interest causes exponential growth because interest yields further interest in subsequent periods.')
add_q('What is a bear market in financial market terminology?',
      ['A market characterized by rising prices and investor optimism', 'A market experiencing prolonged price declines of 20% or more', 'A market with zero trading volume', 'A commodities-only futures exchange'], 'A market experiencing prolonged price declines of 20% or more', 'EASY', 'Business', 'Finance', 'Concept Identification',
      'A bear market denotes widespread pessimism and sustained price drops of at least 20% from recent highs.')
add_q('What is the term for the ease with which an asset can be rapidly converted into ready cash without losing substantial value?',
      ['Solvency', 'Liquidity', 'Volatility', 'Leverage'], 'Liquidity', 'EASY', 'Business', 'Finance', 'Concept Identification',
      'Cash is the most liquid asset; real estate and illiquid private equity require significant time and discount to convert.')
add_q('Which financial statement summarizes a company revenues, expenses, and net profit over a specific accounting period?',
      ['Balance Sheet', 'Income Statement (P&L)', 'Cash Flow Statement', 'Statement of Retained Earnings'], 'Income Statement (P&L)', 'MEDIUM', 'Business', 'Accounting', 'Concept Identification',
      'The Income Statement shows the bottom line net profit or loss generated over a quarter or fiscal year.')
add_q('What economic principle explains why individuals or nations benefit by specializing in producing goods where they hold the lowest opportunity cost?',
      ['Absolute Advantage', 'Comparative Advantage', 'Economies of Scale', 'Diminishing Returns'], 'Comparative Advantage', 'MEDIUM', 'Business', 'Economics', 'Concept Identification',
      'David Ricardo theory of Comparative Advantage demonstrates that trade benefits all parties when specializing where opportunity cost is lowest.')
add_q('What is the benchmark 30-stock index of the Bombay Stock Exchange (BSE), the oldest stock exchange in Asia?',
      ['Nifty 50', 'BSE SENSEX', 'Bank Nifty', 'Dow Jones'], 'BSE SENSEX', 'EASY', 'Business', 'Finance', 'Direct Factual Recall',
      'The BSE SENSEX tracks 30 financially sound and actively traded blue-chip companies listed on the Bombay Stock Exchange.')
add_q('What is the term for the interest rate at which the central bank (like RBI) lends short-term funds to commercial banks against government securities?',
      ['Reverse Repo Rate', 'Repo Rate', 'Bank Rate', 'Cash Reserve Ratio (CRR)'], 'Repo Rate', 'MEDIUM', 'Business', 'Banking', 'Concept Identification',
      'The Repo (Repurchasing Option) Rate is a primary monetary tool used to control money supply and inflation.')
add_q('What international organization headquartered in Washington, D.C. works to foster global monetary cooperation and secure financial stability?',
      ['World Trade Organization (WTO)', 'International Monetary Fund (IMF)', 'World Bank', 'Bank for International Settlements'], 'International Monetary Fund (IMF)', 'EASY', 'Business', 'Economics', 'Direct Factual Recall',
      'The IMF provides balance-of-payments financial assistance and policy surveillance to 190 member countries.')
add_q('What type of debt security is issued by corporations or governments to borrow capital from public investors in exchange for periodic coupon payments?',
      ['Common stock', 'Bond', 'Option', 'Future contract'], 'Bond', 'EASY', 'Business', 'Finance', 'Concept Identification',
      'Bonds are fixed-income debt instruments where borrowers pay scheduled coupon interest until maturity.')
add_q('What economic term describes a prolonged economic slump characterized by high inflation coupled with stagnant growth and high unemployment?',
      ['Hyperinflation', 'Stagflation', 'Deflationary Spiral', 'Recession'], 'Stagflation', 'MEDIUM', 'Business', 'Economics', 'Concept Identification',
      'Stagflation combines economic stagnation with persistent high inflation, posing severe central banking policy dilemmas.')
add_q('What is the term for the portion of customer deposits that commercial banks are legally mandated to maintain as reserves with the central bank in cash?',
      ['Statutory Liquidity Ratio (SLR)', 'Cash Reserve Ratio (CRR)', 'Capital Adequacy Ratio', 'Liquidity Coverage Ratio'], 'Cash Reserve Ratio (CRR)', 'MEDIUM', 'Business', 'Banking', 'Concept Identification',
      'CRR is the percentage of net demand and time liabilities that banks must hold in cash reserves at the central bank.')
add_q('Which international technology company founded by Steve Jobs and Steve Wozniak in 1976 introduced the Macintosh, iPod, and iPhone?',
      ['Microsoft', 'Apple', 'IBM', 'Intel'], 'Apple', 'EASY', 'Business', 'Corporate History', 'Direct Factual Recall',
      'Apple Inc. became the world first publicly traded company to reach a multi-trillion dollar market capitalization.')
add_q('What is the basic economic law stating that all else being equal, as the price of a good increases, quantity demanded decreases?',
      ['Law of Supply', 'Law of Demand', 'Say Law', 'Gresham Law'], 'Law of Demand', 'EASY', 'Business', 'Economics', 'Concept Identification',
      'The Law of Demand reflects the downward-sloping demand curve resulting from substitution and income effects.')
add_q('What financial term describes the legal status of a person or entity that cannot repay debts owed to creditors?',
      ['Amortization', 'Bankruptcy / Insolvency', 'Foreclosure', 'Default'], 'Bankruptcy / Insolvency', 'EASY', 'Business', 'Finance', 'Concept Identification',
      'Bankruptcy provides a court-administered legal framework for liquidating or reorganizing debts when liabilities exceed assets.')
add_q('What is the term for the difference between a country total value of exports and the total value of its imports over a given period?',
      ['Capital Account Balance', 'Balance of Trade', 'Foreign Exchange Reserves', 'Terms of Trade'], 'Balance of Trade', 'MEDIUM', 'Business', 'Economics', 'Concept Identification',
      'A positive balance is a trade surplus (exports exceed imports); a negative balance is a trade deficit.')
add_q('What is the global currency standard reserve asset created by the International Monetary Fund in 1969 to supplement member countries official reserves?',
      ['Euro', 'Special Drawing Rights (SDR)', 'Gold Standard', 'Petrodollar'], 'Special Drawing Rights (SDR)', 'HARD', 'Business', 'Economics', 'Direct Factual Recall',
      'SDRs are supplementary foreign exchange reserve assets defined and maintained by the IMF based on a basket of major currencies.')

# --- Sports, Literature & Arts (15) ---
add_q('Which batsman holds the international cricket record for the highest individual score in a single One Day International (ODI) match (264 runs)?',
      ['Sachin Tendulkar', 'Rohit Sharma', 'Virender Sehwag', 'Chris Gayle'], 'Rohit Sharma', 'EASY', 'Sports', 'Cricket', 'Direct Factual Recall',
      'Rohit Sharma scored 264 runs off 173 balls for India against Sri Lanka at Eden Gardens, Kolkata, on November 13, 2014.')
add_q('Which country has won the FIFA Men World Cup tournament a record five times (1958, 1962, 1970, 1994, 2002)?',
      ['Germany', 'Italy', 'Brazil', 'Argentina'], 'Brazil', 'EASY', 'Sports', 'Football', 'Comparison',
      'Brazil is the most successful national team in FIFA World Cup history with 5 championship titles.')
add_q('Who was the first Indian citizen to win a Nobel Prize, awarded in 1913 in Literature for the poetry collection Gitanjali?',
      ['C. V. Raman', 'Rabindranath Tagore', 'Mother Teresa', 'Amartya Sen'], 'Rabindranath Tagore', 'EASY', 'Literature', 'Indian Heritage', 'Direct Factual Recall',
      'Rabindranath Tagore won the 1913 Nobel Prize in Literature, becoming the first non-European laureate in literature.')
add_q('Which grand slam tennis tournament is traditionally played annually on outdoor grass courts at the All England Club in London?',
      ['Australian Open', 'French Open (Roland Garros)', 'Wimbledon Championships', 'US Open'], 'Wimbledon Championships', 'EASY', 'Sports', 'Tennis', 'Direct Factual Recall',
      'Wimbledon is the oldest tennis tournament in the world (founded 1877) and the only major still played on traditional grass courts.')
add_q('Who authored the tragic play Hamlet, Prince of Denmark during the Elizabethan era?',
      ['Christopher Marlowe', 'William Shakespeare', 'Ben Jonson', 'John Webster'], 'William Shakespeare', 'EASY', 'Literature', 'World Classics', 'Direct Factual Recall',
      'William Shakespeare wrote Hamlet between 1599 and 1601, featuring the famous soliloquy To be, or not to be.')
add_q('Which city hosted the first modern Olympic Games in 1896, reviving the ancient Greek Olympic tradition?',
      ['Paris', 'Athens', 'London', 'Rome'], 'Athens', 'EASY', 'Sports', 'Olympics', 'Direct Factual Recall',
      'The 1896 Summer Olympics were held in Athens, Greece, organized by Pierre de Coubertin and the IOC.')
add_q('Who painted the world-famous renaissance portrait Mona Lisa (La Gioconda), now housed in the Louvre Museum in Paris?',
      ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'], 'Leonardo da Vinci', 'EASY', 'Arts', 'Painting', 'Direct Factual Recall',
      'Leonardo da Vinci painted the Mona Lisa in Florence during the early 16th century using fine sfumato technique.')
add_q('Which country won the inaugural ICC Men T20 Cricket World Cup held in South Africa in 2007?',
      ['Pakistan', 'India', 'Australia', 'West Indies'], 'India', 'EASY', 'Sports', 'Cricket', 'Direct Factual Recall',
      'India captained by MS Dhoni defeated Pakistan by 5 runs in a thrilling final at the Wanderers Stadium in Johannesburg.')
add_q('In chess, what is the maximum number of squares a Knight can theoretically move to from an open central square on the board?',
      ['4', '6', '8', '10'], '8', 'EASY', 'Sports', 'Chess', 'Logical Reasoning',
      'A knight located in the center (e.g. d4 or e5) commands exactly eight candidate squares via its L-shaped leap.')
add_q('Which author created the legendary fictional consulting detective Sherlock Holmes and Dr. John Watson?',
      ['Agatha Christie', 'Arthur Conan Doyle', 'Edgar Allan Poe', 'G. K. Chesterton'], 'Arthur Conan Doyle', 'EASY', 'Literature', 'Classics', 'Direct Factual Recall',
      'Sir Arthur Conan Doyle introduced Sherlock Holmes in the 1887 novel A Study in Scarlet.')
add_q('Which athlete won 8 gold medals in a single Olympic Games (Beijing 2008), setting the all-time record for a single Olympiad?',
      ['Usain Bolt', 'Michael Phelps', 'Carl Lewis', 'Mark Spitz'], 'Michael Phelps', 'EASY', 'Sports', 'Olympics', 'Direct Factual Recall',
      'American swimmer Michael Phelps won 8 gold medals in Beijing 2008, breaking Mark Spitz 1972 record of seven.')
add_q('Which Indian athlete won the historic gold medal in Men Javelin Throw at the Tokyo 2020 Olympics with a throw of 87.58 meters?',
      ['Neeraj Chopra', 'Abhinav Bindra', 'Milkha Singh', 'Bajrang Punia'], 'Neeraj Chopra', 'EASY', 'Sports', 'Olympics', 'Direct Factual Recall',
      'Neeraj Chopra became the second Indian to win an individual Olympic gold medal and the first in track and field athletics.')
add_q('What Spanish surrealist master painted the iconic 1931 artwork The Persistence of Memory featuring melting pocket watches?',
      ['Pablo Picasso', 'Salvador Dalí', 'Joan Miró', 'Francisco Goya'], 'Salvador Dalí', 'EASY', 'Arts', 'Painting', 'Direct Factual Recall',
      'Salvador Dalí depicted soft, melting clocks in a dreamlike Catalan landscape exploring the relativity of time.')
add_q('What ancient Indian epic composed in Sanskrit verse by Sage Vyasa is the longest epic poem known, containing over 100,000 shlokas?',
      ['Ramayana', 'Mahabharata', 'Rigveda', 'Upanishads'], 'Mahabharata', 'EASY', 'Literature', 'Indian Heritage', 'Comparison',
      'The Mahabharata narrates the Kurukshetra War between the Pandavas and Kauravas, encompassing the philosophical Bhagavad Gita.')
add_q('Which football legend led Argentina to victory in the 1986 FIFA World Cup in Mexico, famous for the Hand of God and Goal of the Century?',
      ['Lionel Messi', 'Diego Maradona', 'Gabriel Batistuta', 'Mario Kempes'], 'Diego Maradona', 'EASY', 'Sports', 'Football', 'Direct Factual Recall',
      'Diego Armando Maradona scored both famous goals against England in the quarterfinals en route to winning the 1986 trophy.')

print(f'Total QUICK_QUIZ questions authored: {len(questions)}')

# Save to scripts/data/round1_quick_quiz.json
os.makedirs('scripts/data', exist_ok=True)
with open('scripts/data/round1_quick_quiz.json', 'w', encoding='utf-8') as out:
    json.dump(questions, out, indent=2, ensure_ascii=False)
print('Successfully saved scripts/data/round1_quick_quiz.json')
