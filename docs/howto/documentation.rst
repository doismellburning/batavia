Tips on building the documentation
==================================

Here are some tips for working on this documentation. You're welcome to add more and help us out!

First of all, you should check the `Restructured Text (reST) and Sphinx CheatSheet <http://thomas-cokelaer.info/tutorials/sphinx/rest_syntax.html>`_ to learn how to write your .rst file.

To create a .rst file
---------------------
Look at the structure and choose the best category to put your .rst file. Make sure that it is referenced in the index of the corresponding category, so it will show on in the documentation. If you have no idea how to do this, study the other index files for clues.


To build locally on GNU/Linux and open it on the browser:
---------------------------------------------------------

Install Sphinx: ::

    $ pip install sphinx

Create the static files: ::

    $ make html

The output of the file should be in the _static folder. Check for any errors and, if possible, fix them. Open the file you changed in the browser.