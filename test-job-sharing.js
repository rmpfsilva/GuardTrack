import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${text}`);
  }
  
  const cookies = res.headers.get('set-cookie');
  return cookies || '';
}

async function makeRequest(url, method, cookies, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  
  return await res.json();
}

async function testJobSharingWorkflow() {
  console.log('🧪 Testing Job Sharing Workflow...\n');
  
  try {
    // Step 1: Login as admin_a (Company A)
    console.log('1️⃣  Logging in as admin_a (Company A)...');
    const adminACookies = await login('admin_a', 'test123');
    console.log('✅ Logged in as admin_a\n');
    
    // Step 2: Get companies for job sharing
    console.log('2️⃣  Getting available companies for job sharing...');
    const companies = await makeRequest('/api/companies/for-job-sharing', 'GET', adminACookies);
    console.log(`✅ Found ${companies.length} companies:`, companies.map(c => c.name).join(', '));
    
    if (companies.length === 0) {
      throw new Error('No companies available for job sharing!');
    }
    const companyB = companies.find(c => c.name.includes('Test Security Co B')) || companies[0];
    console.log(`   Will share with: ${companyB.name}\n`);
    
    // Step 3: Get sites
    console.log('3️⃣  Getting sites...');
    const sites = await makeRequest('/api/sites', 'GET', adminACookies);
    console.log(`✅ Found ${sites.length} sites\n`);
    
    if (sites.length === 0) {
      throw new Error('No sites available!');
    }
    const site = sites[0];
    
    // Step 4: Create job share request
    console.log('4️⃣  Creating job share request...');
    const jobShareData = {
      toCompanyId: companyB.id,
      siteId: site.id,
      numberOfJobs: '3',
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-30'),
      workingRole: 'guard',
      hourlyRate: '25.00',
      requirements: 'Experience required, must have valid ID',
    };
    
    const createdShare = await makeRequest('/api/job-shares', 'POST', adminACookies, jobShareData);
    console.log('✅ Job share created:', {
      id: createdShare.id,
      status: createdShare.status,
      numberOfJobs: createdShare.numberOfJobs,
    });
    console.log('\n');
    
    // Step 5: Verify it appears in offered shares
    console.log('5️⃣  Verifying job share appears in offered shares...');
    const offeredShares = await makeRequest('/api/job-shares/offered', 'GET', adminACookies);
    const foundOffered = offeredShares.find(s => s.id === createdShare.id);
    if (!foundOffered) {
      throw new Error('Job share not found in offered shares!');
    }
    console.log('✅ Job share found in offered shares with status:', foundOffered.status, '\n');
    
    // Step 6: Login as admin_b (Company B)
    console.log('6️⃣  Logging in as admin_b (Company B)...');
    const adminBCookies = await login('admin_b', 'test123');
    console.log('✅ Logged in as admin_b\n');
    
    // Step 7: Verify it appears in received shares
    console.log('7️⃣  Verifying job share appears in received shares...');
    const receivedShares = await makeRequest('/api/job-shares/received', 'GET', adminBCookies);
    const foundReceived = receivedShares.find(s => s.id === createdShare.id);
    if (!foundReceived) {
      throw new Error('Job share not found in received shares!');
    }
    console.log('✅ Job share found in received shares:', {
      id: foundReceived.id,
      fromCompany: foundReceived.fromCompany?.name,
      site: foundReceived.site?.name,
      status: foundReceived.status,
    });
    console.log('\n');
    
    // Step 8: Accept the job share
    console.log('8️⃣  Accepting job share...');
    const updatedShare = await makeRequest(
      `/api/job-shares/${createdShare.id}`,
      'PATCH',
      adminBCookies,
      { status: 'accepted' }
    );
    console.log('✅ Job share accepted! New status:', updatedShare.status, '\n');
    
    // Step 9: Verify status is updated for Company A
    console.log('9️⃣  Verifying status update for Company A...');
    const offeredSharesAfter = await makeRequest('/api/job-shares/offered', 'GET', adminACookies);
    const foundAfter = offeredSharesAfter.find(s => s.id === createdShare.id);
    if (!foundAfter || foundAfter.status !== 'accepted') {
      throw new Error('Status not updated correctly!');
    }
    console.log('✅ Status correctly updated to:', foundAfter.status, '\n');
    
    console.log('🎉 All tests passed! Job sharing workflow is working correctly!\n');
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   - Job share created by: ${foundAfter.creator?.username || 'Unknown'}`);
    console.log(`   - From: ${foundAfter.fromCompany?.name || 'Unknown'}`);
    console.log(`   - To: ${foundAfter.toCompany?.name || 'Unknown'}`);
    console.log(`   - Site: ${foundAfter.site?.name || 'Unknown'}`);
    console.log(`   - Positions: ${foundAfter.numberOfJobs}`);
    console.log(`   - Role: ${foundAfter.workingRole}`);
    console.log(`   - Rate: £${foundAfter.hourlyRate}/hour`);
    console.log(`   - Status: ${foundAfter.status}`);
    console.log(`   - Reviewed by: ${foundAfter.reviewer?.username || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testJobSharingWorkflow();
