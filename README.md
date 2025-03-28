# amche-goa

- Homepage: https://amche.in/
- Development preview: https://amche.in/dev

A simple and powerful citizen map portal for the state of Goa, India. Made with the latest map data and tools. _Amche_ mean÷≥kjytrewq  s

## Data

The various map layers are sourced from available open data published by government and community sources. Please check the website layer details for more complete source information.

**State Level**
- [Town & Country Planning Department, Government of Goa (TCP)](https://tcp.goa.gov.in/)
- [Bhunaksha, Directorate of Settlement & Land Records, Government of Goa](https://bhunaksha.goa.gov.in/bhunaksha/)
- [amche.in Community](https://github.com/publicmap/amche-goa/issues)

**National level**
- [ISRO Space Based Earth Observation Applications](https://www.isro.gov.in/SpaceBasedEarthObservationServices.html) | [Bhuvan](https://bhuvan-app1.nrsc.gov.in/) ([Wiki](https://bhuvan.nrsc.gov.in/wiki/index.php/List_of_Vector_(Thematic_Maps)_datasets))
- [National Center For Sustainable Coastal Management (NCSCM)](https://czmp.ncscm.res.in/)
- [National Centre of Geo-Informatics (MeitY-NCOG)](https://mss.ncog.gov.in/login)
- [Ministry of Agriculture & Farmers Welfare, Government of India](https://soilhealth.dac.gov.in/slusi-visualisation/)
- [Ministry of Jal Shakti, Government of India](https://indiawris.gov.in/)
- [Swachh Bharat Mission](https://sbm-g-esriindia1.hub.arcgis.com/)
- [Bharatmaps (NIC)](https://bharatmaps.gov.in/BharatMaps/Home/Map)
- [Survey Of India](https://onlinemaps.surveyofindia.gov.in/FreeMapSpecification.aspx)
- [Election Commission of India (ECI)](https://www.eci.gov.in/delimitation)
- [Perry-Castañeda Library Map Collection, The University of Texas at Austin](https://maps.lib.utexas.edu/maps/ams/india/)
- [DataMeet.org - India Open Data Community](https://datameet.org/)

**Global Level**

- [NASA](https://asterweb.jpl.nasa.gov/gdem.asp)
- [OpenStreetMap Project](https://www.openstreetmap.org/#map=12/15.4661/73.8604) / [OSM India Community](https://www.openstreetmap.in/)

## Software

The development of amche.in was largely made pausible due to [Claude](https://claude.ai/) and [Cursor](https://www.cursor.com/). The website has a simple static site structure with minimal Javascript libraries and is intentinally developed to be as simple as possible to setup and contribute.

- To setup, open your terminal:
  - `git clone git@github.com:publicmap/amche-goa.git` and `cd amche-goa`
  - `python3 -m http.server` to start a local server
  - Open `http://localhost:8000/` in your broswer
- Source code hosted on Github and served via [Github Pages](https://pages.github.com/)
  - Code on `main` branch deploys to https://amche.in and `dev` branch to https://amche.in/dev in under a minute
- Take a look at the [Project Board](https://github.com/publicmap/amche-goa/projects) to take up an issue to contribute to
  - Make sure [issues](https://github.com/publicmap/amche-goa/issues) you are working on is clear and well documented before working on them
  - While working with AI coding, remember to `git commit <file> -m "Commiting these changes since it works` and `git reset --hard` if you need to discard all changes since the last commit when things do not work
  - Reload the page locally to test changes or use `git push origin HEAD:dev --force` to preview commits live for user testing on https://amche.in/dev

**Technical Stack**

- [Mapbox GL JS](https://www.mapbox.com/mapbox-gljs) for client side map rendering and interactivity
- [mapwarper.net](https://mapwarper.net/layers/2054) for georeferencing and hosting of PDF maps
- [Google Fonts](https://fonts.gstatic.com)
- [jQuery](https://jquery.com/) for easy DOM manipulation
- [Shoelace](https://shoelace.style/) for UI components
- [tailwindcss](https://tailwindcss.com/) for responsive CSS framework



