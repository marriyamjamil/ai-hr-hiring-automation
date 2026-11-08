// Free stock photos from Unsplash (https://unsplash.com/license).
// To use your own pictures instead, put them in frontend/public/images
// and change a link below to "/images/your-file.jpg".

function unsplash(id: string, width: number, height?: number) {
  const size = height ? `&w=${width}&h=${height}` : `&w=${width}`;
  return `https://images.unsplash.com/${id}?auto=format&fit=crop${size}&q=80`;
}

export const photos = {
  recruiter: unsplash("photo-1573496359142-b8d87734a5a2", 900, 1100),
  teamLaptops: unsplash("photo-1522071820081-009f0129c71c", 1400),
  highFive: unsplash("photo-1600880292203-757bb62b4baf", 1400),
  devsAtDesk: unsplash("photo-1551434678-e076c223a692", 1400),
  teamMeeting: unsplash("photo-1521737604893-d14cc237f11d", 1400),
  presentation: unsplash("photo-1556761175-5973dc0f32e7", 1400),
  boardroom: unsplash("photo-1542744173-8e7e53415bb0", 1400),
  interview: unsplash("photo-1517245386807-bb43f82c33c4", 1400),
  diverseTeam: unsplash("photo-1531482615713-2afd69097998", 1400),
  stickyNotes: unsplash("photo-1552664730-d307ca884978", 1600),
  office: unsplash("photo-1497366216548-37526070297c", 1600),
};

// Small square portraits (used for sample people in the website)
export const portraits = {
  amara: unsplash("photo-1494790108377-be9c29b29330", 240, 240),
  daniel: unsplash("photo-1507003211169-0a1dd7228f2d", 240, 240),
  sofia: unsplash("photo-1438761681033-6461ffad8d80", 240, 240),
  omar: unsplash("photo-1500648767791-00dcc994a43e", 240, 240),
  helen: unsplash("photo-1573497019940-1c28c88b4f3e", 240, 240),
  james: unsplash("photo-1560250097-0b93528c311a", 240, 240),
  leila: unsplash("photo-1580489944761-15a19d654956", 240, 240),
};
