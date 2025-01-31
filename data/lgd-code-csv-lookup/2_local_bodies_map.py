#
# Script to map the LGD data by urban and rural local body units
# 

# Inputs:
# 1. goa_pri_local_bodies.csv   
# 2. goa_gp_mapping.csv
# 3. goa_pri_local_body_wards.csv
# 4. goa_urban_local_bodies.csv
# 5. goa_constituencies_mapping_urban.csv

# Outputs:
# 1. goa_local_bodies.csv

#
# Installation:
#

import os
import pandas as pd
import csv

# Define state name to extract
state_name='goa'

# Define urban body type mapping
# https://localbodydata.com/urban-local-bodies-of-india
URBAN_BODY_TYPES = {
    4: 'Municipal Corporation',
    5: 'Municipality',
    6: 'Notified Area Council',
    7: 'Town Panchayat',
    8: 'Cantonment Board',
    21: 'NCT Municipal Council',
    24: 'City Municipal Council',
    25: 'Town Municipal Council'
}

# Define rural body type mapping
# https://localbodydata.com/rural-local-bodies-of-india
RURAL_BODY_TYPES = {
    1: 'District Panchayat',
    2: 'Intermediate Panchayat',
    3: 'Village Panchayat'
}

# Input files

## Rural bodies: Panchyati Raj institutions
# Read CSV files and filter out District Panchayat
rural_body_wards = pd.read_csv('./filtered/goa_pri_local_body_wards.csv')
rural_body_wards = rural_body_wards[rural_body_wards['Local Body Type'] != 'District Panchayat']
rural_body_villages = pd.read_csv('./filtered/goa_gp_mapping.csv')

## Urban bodies: Muncipal governments
urban_body_wards = pd.read_csv('./filtered/goa_constituencies_mapping_urban.csv')

# DEBUG: Print available names
print("\nrural_body_wards:")
print("\n".join(rural_body_wards.columns.tolist()))

print("\nrural_body_villages:")
print("\n".join(rural_body_villages.columns.tolist()))

print("\nurban_body_wards:")
print("\n".join(urban_body_wards.columns.tolist()))

# Debug: Print actual column names
print("\nActual urban_body_wards columns:")
print(urban_body_wards.columns.tolist())

# Debug: Print detailed column information
print("\nDetailed column analysis:")
for col in urban_body_wards.columns:
    print(f"Column: '{col}' (length: {len(col)})")
    print(f"ASCII values: {[ord(c) for c in col]}")

# Debug: Print exact matches we're looking for
required_columns = ['Urban Localbody Code', 'District Name', 'District Code', 'SubDistrict Code', 'SubDistrict Name']
print("\nChecking for required columns:")
for col in required_columns:
    exists = col in urban_body_wards.columns
    print(f"'{col}' exists: {exists}")
    if not exists:
        close_matches = [existing for existing in urban_body_wards.columns if col.lower() in existing.lower()]
        print(f"Possible matches: {close_matches}")

# Get the exact column names from the DataFrame
urban_cols = urban_body_wards.columns.tolist()

# Find the exact column names we need
urban_code_col = [col for col in urban_cols if 'Urban Localbody Code' in col][0]
district_name_col = [col for col in urban_cols if 'District Name' in col][0]
district_code_col = [col for col in urban_cols if 'District Code' in col][0]
subdistrict_code_col = [col for col in urban_cols if 'SubDistrict Code' in col][0]
subdistrict_name_col = [col for col in urban_cols if 'SubDistrict Name' in col][0]

# Debug: Print the columns we found
print("\nFound column names:")
print(f"Urban code: '{urban_code_col}'")
print(f"District name: '{district_name_col}'")
print(f"District code: '{district_code_col}'")
print(f"Subdistrict code: '{subdistrict_code_col}'")
print(f"Subdistrict name: '{subdistrict_name_col}'")

# Create list of columns to use
columns_to_use = [
    urban_code_col,
    district_name_col,
    district_code_col,
    subdistrict_code_col,
    subdistrict_name_col
]

# Use the column list
urban_districts = urban_body_wards.groupby('Urban Localbody Code').agg({
    'District Code': lambda x: x.dropna().iloc[0] if not x.dropna().empty else '',
    'District Name': lambda x: x.dropna().iloc[0] if not x.dropna().empty else '',
    'SubDistrict Code': lambda x: x.dropna().iloc[0] if not x.dropna().empty else '',
    'SubDistrict Name': lambda x: x.dropna().iloc[0] if not x.dropna().empty else ''
}).reset_index()

# Rename columns to standardize them
urban_districts = urban_districts.rename(columns={
    'Urban Localbody Code': 'Code'
})

# Convert codes to string, handling NA values
urban_districts['District Code'] = urban_districts['District Code'].fillna('').astype(str)
urban_districts['District Code'] = urban_districts['District Code'].apply(lambda x: str(int(float(x))) if x else '')
urban_districts['SubDistrict Code'] = urban_districts['SubDistrict Code'].fillna('').astype(str)
urban_districts['SubDistrict Code'] = urban_districts['SubDistrict Code'].apply(lambda x: str(int(float(x))) if x else '')

# Create rural_districts with renamed columns and ensure district code is string
rural_districts = rural_body_villages[[
    'Local Body Code',
    'District Name (in English)',
    'District Code',
    'Sub District Code',
    'Sub District Name (in English)'
]].drop_duplicates()

# Rename the columns to match our standardized names
rural_districts = rural_districts.rename(columns={
    'Local Body Code': 'Code',
    'District Name (in English)': 'District Name',
    'Sub District Name (in English)': 'SubDistrict Name',
    'Sub District Code': 'SubDistrict Code'
})

# Convert codes to string, handling NA values
rural_districts['District Code'] = rural_districts['District Code'].fillna('').astype(str)
rural_districts['District Code'] = rural_districts['District Code'].apply(lambda x: str(int(float(x))) if x else '')
rural_districts['SubDistrict Code'] = rural_districts['SubDistrict Code'].fillna('').astype(str)
rural_districts['SubDistrict Code'] = rural_districts['SubDistrict Code'].apply(lambda x: str(int(float(x))) if x else '')

# Standardize column names based on actual CSV headers
urban_body_wards = urban_body_wards.rename(columns={
    'Urban Localbody Code': 'Code',
    'Urban Localbody Name': 'Name',
    'Localbody Type': 'Type',
    'SubDistrict Name': 'SubDistrict Name'  # This should match exactly
})

rural_body_villages = rural_body_villages.rename(columns={
    'Local Body Code': 'Code',
    'Local Body Name (in English)': 'Name',
    'Local Body Type': 'Type',
    'Sub District Name (in English)': 'SubDistrict Name',
    'District Name (in English)': 'District Name'
})

# Standardize column names for rural_body_wards
rural_body_wards = rural_body_wards.rename(columns={
    'Local Body Code': 'Code',
    'Local Body Name': 'Name',
    'Local Body Type': 'Type'
})

# Derive rural_bodies from ward mapping (similar to urban_bodies)
rural_bodies = rural_body_wards.groupby([
    'Code'
]).first().reset_index()

# Derive urban_bodies from ward mapping
urban_bodies = urban_body_wards.groupby([
    'Code'
]).first().reset_index()


# Remove all-NA columns before concatenation
urban_bodies = urban_bodies.dropna(axis=1, how='all')
rural_bodies = rural_bodies.dropna(axis=1, how='all')

# Concatenate the urban and rural dataframes
all_bodies = pd.concat([rural_bodies, urban_bodies], ignore_index=True)

def map_subdistrict_names(all_bodies, urban_body_wards, rural_body_villages):
    # First ensure the column exists in all_bodies
    if 'SubDistrict Name' not in all_bodies.columns:
        all_bodies['SubDistrict Name'] = pd.NA
    
    # For urban bodies, group by Code to get unique subdistrict mappings
    valid_urban_mapping = urban_body_wards.dropna(subset=['SubDistrict Name'])\
        .groupby('Code')\
        .agg({
            'SubDistrict Name': 'first'
        })\
        .reset_index()
    
    # For rural bodies, group by Code to get unique subdistrict mappings
    valid_pri_mapping = rural_body_villages.dropna(subset=['SubDistrict Name'])\
        .groupby('Code')\
        .agg({
            'SubDistrict Name': 'first'
        })\
        .reset_index()
    
    # Combine both mapping dataframes
    combined_mapping = pd.concat([valid_urban_mapping, valid_pri_mapping], ignore_index=True)

    # Update SubDistrict Name using merge
    merged_data = all_bodies.merge(
        combined_mapping, 
        on='Code', 
        how='left',
        suffixes=('', '_new')
    )

    # Update only where original values are NA
    all_bodies['SubDistrict Name'] = all_bodies['SubDistrict Name'].fillna(merged_data['SubDistrict Name_new'])
    
    return all_bodies

# Replace the original code with function call
all_bodies = map_subdistrict_names(all_bodies, urban_body_wards, rural_body_villages)

def create_village_mapping(rural_body_villages):
    # First pass: identify villages that appear in multiple panchayats
    village_occurrences = {}
    for _, row in rural_body_villages.iterrows():
        if pd.notna(row['Code']) and pd.notna(row['Village Name (in English)']):
            village_name = row['Village Name (in English)']
            if village_name not in village_occurrences:
                village_occurrences[village_name] = set()
            village_occurrences[village_name].add(str(int(row['Code'])))

    # Create mapping of panchayat codes to village names
    village_to_panchayat = {}
    for _, row in rural_body_villages.iterrows():
        if pd.notna(row['Code']) and pd.notna(row['Village Name (in English)']):
            lb_code = str(int(row['Code']))
            village_name = row['Village Name (in English)']
            
            # Add '(part)' suffix if village appears in multiple panchayats
            if len(village_occurrences[village_name]) > 1:
                village_name = f"{village_name} (part)"
                
            if lb_code not in village_to_panchayat:
                village_to_panchayat[lb_code] = set()
            village_to_panchayat[lb_code].add(village_name)
    
    return village_to_panchayat

# Replace the original code with function call
village_to_panchayat = create_village_mapping(rural_body_villages)

# Add the village names to all_bodies
all_bodies['Village Names'] = all_bodies['Code'].astype(str).map(
    lambda x: ', '.join(sorted(village_to_panchayat.get(x, []))) or None
)

# Before saving the combined data, add ward count
# Count wards for rural bodies
rural_ward_counts = rural_body_wards.groupby('Code').size()

# Count wards for urban bodies
urban_ward_counts = urban_body_wards.groupby('Code').size()

# Combine both counts into a single series
all_ward_counts = pd.concat([
    rural_ward_counts.rename('count'),
    urban_ward_counts.rename('count')
])

# Map the counts to all_bodies
all_bodies['Ward Count'] = all_bodies['Code'].map(all_ward_counts).fillna(0).astype(int)

# Merge the district information into all_bodies
all_bodies = all_bodies.merge(
    pd.concat([rural_districts, urban_districts]), 
    on='Code', 
    how='left',
    suffixes=('_old', '')  # Keep the new values from the districts data
)

# Add Class field based on body type and village names
def determine_class(row):
    # Check if body type is Municipal Corporation
    if row['Type'] == 'Municipal Corporation':
        return 'City'
    # Check if body type is in urban types
    elif row['Type'] in URBAN_BODY_TYPES.values():
        return 'Town'
    # For rural bodies, check village names for special cases
    elif pd.notna(row['Village Names']) and any(suffix in str(row['Village Names']) for suffix in ['(Ct)', '(Og)']):
        return 'Suburb'
    else:
        return 'Village'

all_bodies['Class'] = all_bodies.apply(determine_class, axis=1)

# Update the column order to match actual column names in the dataframe
column_order = [
    'Code',
    'Name',
    'Class',
    'Type',
    'District Code',
    'District Name',
    'SubDistrict Code',
    'SubDistrict Name',
    'Parliament Constituency code',
    'Parliament Constituency Name',
    'Assembly Constituency Code',
    'Assembly Constituency Name',
    'Ward Count',
    'Village Names'
]

# First ensure all required columns exist
for col in column_order:
    if col not in all_bodies.columns:
        all_bodies[col] = None  # Add missing columns with None values

# Now reorder columns and sort
all_bodies = all_bodies[column_order].sort_values(
    by=['District Name', 'SubDistrict Name', 'Class', 'Name'],
    ascending=[True, True, False, True]
)

# Add new lookup dictionaries for constituency mappings
urban_ward_constituency_map = {}
rural_ward_constituency_map = {}

def load_constituency_mappings():
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Load urban constituency mappings
    mapping_file = os.path.join(script_dir, 'filtered', 'goa_constituencies_mapping_urban.csv')
    print(f"Loading urban constituency mappings from: {mapping_file}")
    
    with open(mapping_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ward_code = row['Ward Code']
            parliament_code = row['Parliament Constituency code']
            parliament_name = row['Parliament Constituency Name']
            assembly_code = row['Assembly Constituency Code'] 
            assembly_name = row['Assembly Constituency Name']
            
            urban_ward_constituency_map[ward_code] = (
                parliament_code,
                parliament_name, 
                assembly_code,
                assembly_name
            )
    
    # Load rural constituency mappings from coverage file
    coverage_file = os.path.join(script_dir, 'filtered', 'goa_constituency_coverage.csv')
    print(f"\nLoading rural constituency mappings from: {coverage_file}")
    
    # Create a mapping of villages to constituencies
    village_constituency_map = {}
    with open(coverage_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Entity Type'] == 'Village':
                village_code = row['Entity Code']
                parliament_code = row['Parliament Constituency Code']
                parliament_name = row['Parliament Constituency Name']
                assembly_code = row['Assembly Constituency Code']
                assembly_name = row['Assembly Constituency Name']
                
                village_constituency_map[village_code] = (
                    parliament_code,
                    parliament_name,
                    assembly_code,
                    assembly_name
                )
    
    # Debug: Print column names
    print("\nRural body villages columns:")
    print(rural_body_villages.columns.tolist())
    
    # For rural bodies, map based on their villages
    for _, row in rural_body_villages.iterrows():
        if pd.notna(row['Code']) and pd.notna(row['Village Code']):  # Changed from 'Local Body Code'
            body_code = str(int(row['Code']))  # Changed from 'Local Body Code'
            village_code = str(row['Village Code'])
            
            if village_code in village_constituency_map:
                rural_ward_constituency_map[body_code] = village_constituency_map[village_code]
    
    print(f"\nLoaded {len(urban_ward_constituency_map)} urban and {len(rural_ward_constituency_map)} rural constituency mappings")

def process_row(row):
    # Add constituency fields with defaults
    parliament_code = ''
    parliament_name = ''
    assembly_code = ''
    assembly_name = ''
    
    body_code = str(row['Code'])
    
    # Debug: Print row info
    print(f"\nProcessing {row['Type']} body: {row['Name']} (Code: {body_code})")
    
    # For urban bodies, use the ward mapping
    if row['Type'] in URBAN_BODY_TYPES.values():
        body_wards = urban_body_wards[urban_body_wards['Code'] == row['Code']]
        if not body_wards.empty:
            first_ward = body_wards.iloc[0]
            ward_code = str(first_ward['Ward Code'])
            if ward_code in urban_ward_constituency_map:
                parliament_code, parliament_name, assembly_code, assembly_name = urban_ward_constituency_map[ward_code]
                print(f"Found urban mapping: {parliament_name} / {assembly_name}")
    
    # For rural bodies, use the direct mapping
    elif body_code in rural_ward_constituency_map:
        parliament_code, parliament_name, assembly_code, assembly_name = rural_ward_constituency_map[body_code]
        print(f"Found rural mapping: {parliament_name} / {assembly_name}")
    else:
        print("No constituency mapping found")
    
    # Add new fields to row
    row['Parliament Constituency code'] = parliament_code
    row['Parliament Constituency Name'] = parliament_name 
    row['Assembly Constituency Code'] = assembly_code
    row['Assembly Constituency Name'] = assembly_name
    
    return row

# Load constituency mappings before processing
print("Loading constituency mappings...")
load_constituency_mappings()

# Apply constituency mapping to each row
print("Adding constituency information...")
all_bodies = all_bodies.apply(process_row, axis=1)

# Before saving, rename Panaji
all_bodies.loc[all_bodies['Name'] == 'City Corporation Panaji', 'Name'] = 'Panaji'

def get_village_pincodes():
    # Read the pincode villages file
    pincode_villages = {}  # Map village code to pincode
    with open('./filtered/goa_pincode_villages.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            village_code = row['Village Code']
            pincode = row['Pincode']
            pincode_villages[village_code] = pincode

    # Read the GP mapping file to get village to GP mapping
    village_to_gp = {}  # Map village code to GP code
    with open('./filtered/goa_gp_mapping.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            village_code = row['Village Code']
            gp_code = row['Local Body Code']
            if village_code and gp_code:  # Skip empty codes
                village_to_gp[village_code] = gp_code

    # Build mapping of GP to pincodes
    gp_pincodes = {}  # Map GP code to set of pincodes
    for village_code, pincode in pincode_villages.items():
        if village_code in village_to_gp:
            gp_code = village_to_gp[village_code]
            if gp_code not in gp_pincodes:
                gp_pincodes[gp_code] = set()
            gp_pincodes[gp_code].add(pincode)

    return gp_pincodes

def update_local_bodies():
    gp_pincodes = get_village_pincodes()
    
    # Read and update local bodies file
    rows = []
    with open('./goa_local_body_lookup.csv', 'r') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        for row in reader:
            gp_code = row['Code']
            if gp_code in gp_pincodes:
                pincodes = sorted(gp_pincodes[gp_code])
                row['Pincodes'] = ', '.join(pincodes)
            rows.append(row)

    # Write updated file
    with open('./goa_local_body_lookup.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)

if __name__ == '__main__':
    update_local_bodies()

