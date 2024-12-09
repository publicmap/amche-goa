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

state_code=30
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

# Standardize column names based on actual CSV headers

rural_body_wards = rural_body_wards.rename(columns={
    'Local Body Code': 'Code',
    'Local Body Name': 'Name',
    'Local Body Type': 'Type'
}) 

rural_body_villages = rural_body_villages.rename(columns={
    'Local Body Code': 'Code',
    'Local Body Name (in English)': 'Name',
    'Local Body Type': 'Type',
    'Sub District Name (in English)': 'Subdistrict Name',
    'District Name (in English)': 'District Name'
})

urban_body_wards = urban_body_wards.rename(columns={
    'Urban Localbody Code': 'Code',
    'Urban Localbody Name': 'Name',
    'Localbody Type': 'Type',
    'SubDistrict Name': 'Subdistrict Name'
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
    if 'Subdistrict Name' not in all_bodies.columns:
        all_bodies['Subdistrict Name'] = pd.NA
    
    # For urban bodies, group by Urban Localbody Code to get unique subdistrict mappings
    valid_urban_mapping = urban_body_wards.dropna(subset=['Subdistrict Name'])\
        .groupby('Code')\
        .agg({
            'Subdistrict Name': 'first'
        })\
        .reset_index()
    
    # For rural bodies, group by Local Body Code to get unique subdistrict mappings
    valid_pri_mapping = rural_body_villages.dropna(subset=['Subdistrict Name'])\
        .groupby('Code')\
        .agg({
            'Subdistrict Name': 'first'
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
    all_bodies['Subdistrict Name'] = all_bodies['Subdistrict Name'].fillna(merged_data['Subdistrict Name_new'])
    
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

# Load the district information from the mapping files
urban_districts = urban_body_wards[['Code', 'District Name']].drop_duplicates()
rural_districts = rural_body_villages[['Code', 'District Name']].drop_duplicates()

# Concatenate the district information
all_districts = pd.concat([urban_districts, rural_districts], ignore_index=True)

# Merge the district information into all_bodies
# Modified merge to handle the column naming properly
all_bodies = all_bodies.drop(columns=['District Name'], errors='ignore')  # Remove any existing District Name column
all_bodies = all_bodies.merge(all_districts, on='Code', how='left')

# Update the drop columns list to include 'District Name_y' instead of 'District Name'
all_bodies = all_bodies.drop(columns=[
    'S.No.',
    'Ward Code', 
    'Ward Number', 
    'Ward Name',
    'Ward Name (In English)', 
    'Ward Name (In Local)',
    'District Level Parent Name',
    'State Code', 
    'State Name',
    'Parliament Constituency code',
    'Parliament Constituency Code',
    'Parliament Constituency ECI Code',
    'Parliament Constituency Name',
    'Assembly Constituency Code',
    'Assembly Constituency ECI Code',
    'Assembly Constituency Name',
    'District Code',
    'SubDistrict Code'
], errors='ignore')

# Add Class field based on body type and village names
def determine_class(row):
    # Check if body type is in urban types
    if row['Type'] in URBAN_BODY_TYPES.values():
        return 'Urban'
    # For rural bodies, check village names for special cases
    elif pd.notna(row['Village Names']) and any(suffix in str(row['Village Names']) for suffix in ['(Ct)', '(Og)']):
        return 'Rurban'
    else:
        return 'Rural'

all_bodies['Class'] = all_bodies.apply(determine_class, axis=1)

# Reorder columns in a more natural sequence
column_order = [
    'Code',
    'Name',
    'Class',
    'Type',
    'District Name',
    'Subdistrict Name',
    'Ward Count',
    'Village Names'
]

# Reorder columns and sort by District, Subdistrict, Name in descending order
all_bodies = all_bodies[column_order].sort_values(
    by=['Class','District Name', 'Subdistrict Name', 'Name'],
    ascending=[False, True, True, True]
)

# Save the updated data
all_bodies.to_csv('./goa_local_body_lookup.csv', index=False)

