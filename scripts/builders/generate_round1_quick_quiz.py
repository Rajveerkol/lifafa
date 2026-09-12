# Round 1: QUICK_QUIZ Questions Pool (225 authentic questions)
import json

def get_quick_quiz_questions():
    questions = []
    
    # Helper to append
    def add_q(prompt, options, correct_answer, difficulty, category, subcategory, pattern_type, explanation, time_limit=25):
        assert len(options) == 4, f'Options count must be 4: {prompt}'
        assert len(set(options)) == 4, f'Options must be unique: {prompt}'
        assert correct_answer in options, f'Correct answer must be in options: {prompt}'
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

    # --- SCIENCE & PHYSICS (30) ---
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
          'The Ohm (symbol: Ω) is defined as the resistance between two points when 1 volt produces 1 ampere.')
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
          'Pure liquid water has an anomalous density peak at approximately 3.98°C (approx 4°C).')
    add_q('What type of optical lens is used to correct myopia (nearsightedness)?',
          ['Convex lens', 'Concave lens', 'Cylindrical lens', 'Bifocal prism'], 'Concave lens', 'EASY', 'Science', 'Optics', 'Application',
          'A diverging concave lens spreads incoming rays so the image focuses directly on the retina.')
    add_q('In quantum physics, which constant establishes the direct relation E = hf?',
          ['Boltzmann constant', 'Planck constant', 'Avogadro constant', 'Rydberg constant'], 'Planck constant', 'MEDIUM', 'Science', 'Quantum Physics', 'Concept Identification',
          'Max Planck introduced h (≈ 6.626 × 10⁻³⁴ J·s) to relate photon energy with electromagnetic frequency.')
    add_q('Which metallic chemical element is liquid at standard ambient temperature (25°C)?',
          ['Gallium', 'Mercury', 'Bromine', 'Cesium'], 'Mercury', 'EASY', 'Science', 'Chemistry', 'Direct Factual Recall',
          'Mercury (Hg) is the only metal that is liquid under standard ambient conditions.')
    add_q('What type of radioactive decay emits a helium nucleus consisting of 2 protons and 2 neutrons?',
          ['Alpha decay', 'Beta-minus decay', 'Beta-plus decay', 'Gamma emission'], 'Alpha decay', 'MEDIUM', 'Science', 'Nuclear Physics', 'Concept Identification',
          'An alpha particle is identical to a helium-4 nucleus (2 protons and 2 neutrons).')
    add_q('What is the SI unit of magnetic flux density?',
          ['Weber', 'Tesla', 'Henry', 'Gauss'], 'Tesla', 'MEDIUM', 'Science', 'Electromagnetism', 'Unit Definition',
          'One Tesla equals one Weber per square meter (Wb/m²).')
    add_q('Which phenomenon explains the apparent frequency shift of a wave when the source moves relative to an observer?',
          ['Doppler Effect', 'Compton Effect', 'Photoelectric Effect', 'Cherenkov Radiation'], 'Doppler Effect', 'EASY', 'Science', 'Acoustics', 'Concept Identification',
          'The Doppler effect causes perceived frequency increases when approaching and decreases when receding.')
    add_q('Which state of matter consists of a gas of ionized atoms with free electrons at high temperatures?',
          ['Bose-Einstein Condensate', 'Plasma', 'Superfluid', 'Amorphous Solid'], 'Plasma', 'EASY', 'Science', 'Physics', 'Concept Identification',
          'Plasma is the fourth state of matter, common in lightning, stars, and fusion reactors.')
    add_q('According to Einstein Special Theory of Relativity, what happens to the mass of an object as its velocity approaches light speed?',
          ['Decreases to zero', 'Remains strictly constant', 'Increases towards infinity', 'Fluctuates periodically'], 'Increases towards infinity', 'HARD', 'Science', 'Relativity', 'Cause and Effect',
          'Relativistic mass approaches infinity as speed approaches c, requiring infinite energy to accelerate further.')
    add_q('Which electromagnetic radiation possesses wavelengths immediately shorter than visible light?',
          ['Infrared', 'Ultraviolet', 'X-rays', 'Microwaves'], 'Ultraviolet', 'MEDIUM', 'Science', 'Electromagnetism', 'Sequence / Order',
          'Ultraviolet radiation lies between visible violet light and higher-energy X-rays.')
    add_q('What property of a fluid measures its internal resistance to flow and shear deformation?',
          ['Surface tension', 'Viscosity', 'Buoyancy', 'Capillarity'], 'Viscosity', 'EASY', 'Science', 'Fluid Dynamics', 'Concept Identification',
          'Viscosity quantifies internal friction between moving fluid layers.')
    add_q('In electrical circuits, what does Kirchhoff Current Law (KCL) state regarding a node?',
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

    print(f'Quick quiz questions count so far: {len(questions)}')
    return questions

if __name__ == '__main__':
    qs = get_quick_quiz_questions()
    print(f'Done with base {len(qs)}')
